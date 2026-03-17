import asyncio
from collections import defaultdict, deque
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Trade, TradeSide
from app.routers.users import get_current_user, User
from app.services.market import get_quote
from app.services.ai import generate

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _calc_streak(trades):
    days = set(t.created_at.date() for t in trades if t.created_at)
    streak = 0
    today = datetime.now(timezone.utc).date()
    for i in range(365):
        d = today - timedelta(days=i)
        if d in days:
            streak += 1
        elif i > 0:
            break
    return streak


def _fifo_metrics(trades):
    """Returns (realized_pnl, realized_list, open_positions, avg_buy_prices)."""
    buy_queues = defaultdict(deque)   # symbol -> deque of {"qty", "price"}
    realized = []                      # {"pnl", "date", "symbol"}
    totals = defaultdict(lambda: {"qty": 0.0, "cost": 0.0})
    avg_buy = {}                       # symbol -> avg cost per share

    for t in sorted(trades, key=lambda x: x.created_at):
        if t.side == TradeSide.buy:
            buy_queues[t.symbol].append({"qty": t.quantity, "price": t.price_at_trade})
            totals[t.symbol]["qty"]  += t.quantity
            totals[t.symbol]["cost"] += t.total_value
            avg_buy[t.symbol] = totals[t.symbol]["cost"] / totals[t.symbol]["qty"]
        else:
            remaining  = t.quantity
            sell_price = t.price_at_trade
            pnl = 0.0
            while remaining > 1e-9 and buy_queues[t.symbol]:
                buy     = buy_queues[t.symbol][0]
                matched = min(remaining, buy["qty"])
                pnl        += matched * (sell_price - buy["price"])
                remaining  -= matched
                buy["qty"] -= matched
                if buy["qty"] < 1e-9:
                    buy_queues[t.symbol].popleft()
            totals[t.symbol]["qty"]  -= t.quantity
            totals[t.symbol]["cost"] -= t.total_value
            realized.append({"pnl": pnl, "date": t.created_at, "symbol": t.symbol})

    open_pos = {
        sym: v for sym, v in totals.items() if v["qty"] > 1e-4
    }
    return realized, open_pos, avg_buy


@router.get("")
async def dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Trade).where(Trade.user_id == current_user.id))
    trades = result.scalars().all()

    streak = _calc_streak(trades)
    realized, open_pos, avg_buy = _fifo_metrics(trades)

    realized_pnl = sum(r["pnl"] for r in realized)

    # Unrealized P&L for open positions
    unrealized_pnl = 0.0
    for symbol, pos in open_pos.items():
        try:
            q = await asyncio.to_thread(get_quote, symbol)
            avg_cost = pos["cost"] / pos["qty"]
            unrealized_pnl += (q["price"] - avg_cost) * pos["qty"]
        except Exception:
            pass

    total_pnl = realized_pnl + unrealized_pnl
    total_invested = sum(t.total_value for t in trades if t.side == TradeSide.buy)
    total_pnl_pct = (total_pnl / total_invested * 100) if total_invested > 0 else 0.0

    # Win rate
    wins = sum(1 for r in realized if r["pnl"] > 0)
    win_rate = (wins / len(realized) * 100) if realized else 0.0

    # Best trade
    best_pnl = max((r["pnl"] for r in realized), default=0.0)
    best_trade = f"+${best_pnl:.2f}" if best_pnl > 0 else "—"

    # Weekly bar chart (last 7 days, realized P&L per day)
    today = datetime.now(timezone.utc).date()
    weekly = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_pnl = sum(r["pnl"] for r in realized if r["date"].date() == day)
        weekly.append({"date": day.strftime("%a"), "pnl": round(day_pnl, 2)})

    # Recent trades (last 5) with return %
    recent_raw = sorted(trades, key=lambda x: x.created_at, reverse=True)[:5]
    recent_out = []
    symbols_needed = {t.symbol for t in recent_raw if t.side == TradeSide.buy}
    live_prices = {}
    for sym in symbols_needed:
        try:
            q = await asyncio.to_thread(get_quote, sym)
            live_prices[sym] = q["price"]
        except Exception:
            pass

    for t in recent_raw:
        ret_pct = None
        if t.side == TradeSide.buy and t.symbol in live_prices:
            current = live_prices[t.symbol]
            ret_pct = round((current - t.price_at_trade) / t.price_at_trade * 100, 2)
        elif t.side == TradeSide.sell and t.symbol in avg_buy:
            ret_pct = round((t.price_at_trade - avg_buy[t.symbol]) / avg_buy[t.symbol] * 100, 2)

        recent_out.append({
            "id": t.id,
            "symbol": t.symbol,
            "side": t.side,
            "total_value": round(t.total_value, 2),
            "created_at": t.created_at.isoformat(),
            "return_pct": ret_pct,
        })

    return {
        "streak": streak,
        "total_pnl": round(total_pnl, 2),
        "total_pnl_pct": round(total_pnl_pct, 2),
        "weekly_returns": weekly,
        "win_rate": round(win_rate, 1),
        "total_trades": len(trades),
        "best_trade": best_trade,
        "recent_trades": recent_out,
    }


@router.get("/insight")
async def insight(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Trade).where(Trade.user_id == current_user.id))
    trades = result.scalars().all()

    if not trades:
        return {"tip": "Place your first paper trade and I'll give you personalised coaching tips!"}

    symbols   = list({t.symbol for t in trades})[:6]
    buys      = sum(1 for t in trades if t.side == TradeSide.buy)
    sells     = sum(1 for t in trades if t.side == TradeSide.sell)
    _, _, avg = _fifo_metrics(trades)

    prompt = (
        f"You are a concise trading coach for beginner paper traders. "
        f"The user has made {len(trades)} trades ({buys} buys, {sells} sells) "
        f"across {', '.join(symbols)}. "
        f"Give ONE specific, actionable coaching tip in 2-3 sentences. "
        f"Be direct and encouraging. No disclaimers."
    )
    tip = await generate(prompt)
    return {"tip": tip}
