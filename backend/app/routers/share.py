import json
import secrets
from collections import defaultdict, deque
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import ShareCard, Trade, TradeSide, User
from app.routers.users import get_current_user

router = APIRouter(prefix="/share", tags=["share"])


def _compute_stats(trades) -> dict:
    """Derive win_rate, total_pnl_pct, best_trade from raw Trade rows."""
    buy_queues: dict = defaultdict(deque)
    realized = []
    totals: dict = defaultdict(lambda: {"qty": 0.0, "cost": 0.0})

    for t in sorted(trades, key=lambda x: x.created_at):
        if t.side == TradeSide.buy:
            buy_queues[t.symbol].append({"qty": t.quantity, "price": t.price_at_trade})
            totals[t.symbol]["qty"] += t.quantity
            totals[t.symbol]["cost"] += t.total_value
        else:
            remaining = t.quantity
            pnl = 0.0
            while remaining > 1e-9 and buy_queues[t.symbol]:
                buy = buy_queues[t.symbol][0]
                matched = min(remaining, buy["qty"])
                pnl += matched * (t.price_at_trade - buy["price"])
                remaining -= matched
                buy["qty"] -= matched
                if buy["qty"] < 1e-9:
                    buy_queues[t.symbol].popleft()
            realized.append(pnl)

    # Also count closed buy trades (exit_price set)
    for t in trades:
        if t.side == TradeSide.buy and t.pnl is not None:
            realized.append(t.pnl)

    realized_pnl = sum(realized)
    total_invested = sum(t.total_value for t in trades if t.side == TradeSide.buy)
    total_pnl_pct = (realized_pnl / total_invested * 100) if total_invested > 0 else 0.0
    win_rate = (sum(1 for p in realized if p > 0) / len(realized) * 100) if realized else 0.0
    best_pnl = max(realized, default=0.0)
    best_trade = f"+£{best_pnl:.2f}" if best_pnl > 0 else "—"

    return {
        "win_rate": round(win_rate, 1),
        "total_pnl_pct": round(total_pnl_pct, 2),
        "best_trade": best_trade,
        "total_trades": len(trades),
    }


@router.post("")
async def create_share(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Trade).where(Trade.user_id == current_user.id))
    trades = result.scalars().all()

    stats = _compute_stats(trades)
    stats["name"] = current_user.email.split("@")[0]

    share_id = secrets.token_urlsafe(8)
    card = ShareCard(
        id=share_id,
        user_id=current_user.id,
        data=json.dumps(stats),
    )
    db.add(card)
    await db.commit()

    base = str(request.base_url).rstrip("/")
    return {"share_id": share_id, "url": f"{base}/share/{share_id}"}


@router.get("/{share_id}", response_class=HTMLResponse)
async def view_share(share_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ShareCard).where(ShareCard.id == share_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Share card not found")

    stats = json.loads(card.data)
    name = stats.get("name", "Trader")
    win_rate = stats.get("win_rate", 0)
    total_pnl_pct = stats.get("total_pnl_pct", 0)
    best_trade = stats.get("best_trade", "—")
    total_trades = stats.get("total_trades", 0)
    return_color = "#1d9e75" if total_pnl_pct >= 0 else "#e05252"
    return_sign = "+" if total_pnl_pct >= 0 else ""
    created = card.created_at.strftime("%-d %b %Y") if card.created_at else ""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta property="og:title" content="{name}'s UpAlpha Trading Stats">
  <meta property="og:description" content="Win rate {win_rate}% · Return {return_sign}{total_pnl_pct}% · Best trade {best_trade}">
  <title>{name}'s UpAlpha Stats</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background: #0d0d0d;
      color: #f0f0f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
    }}
    .card {{
      background: #111;
      border: 1px solid #222;
      border-radius: 24px;
      width: 100%;
      max-width: 480px;
      overflow: hidden;
      box-shadow: 0 24px 80px #0008;
    }}
    .accent-bar {{ height: 4px; background: #1d9e75; }}
    .card-body {{ padding: 2rem 2rem 1.5rem; }}
    .logo {{ font-size: 1rem; font-weight: 700; color: #1d9e75; letter-spacing: -0.3px; margin-bottom: 1.5rem; }}
    .trader-name {{ font-size: 1.75rem; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 0.25rem; }}
    .subtitle {{ font-size: 0.82rem; color: #666; margin-bottom: 2rem; }}
    .stats {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 2rem; }}
    .stat {{ background: #1a1a1a; border-radius: 14px; padding: 1rem; text-align: center; }}
    .stat-label {{ font-size: 0.68rem; color: #666; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }}
    .stat-value {{ font-size: 1.4rem; font-weight: 700; }}
    .footer {{ font-size: 0.72rem; color: #444; display: flex; justify-content: space-between; padding-top: 1rem; border-top: 1px solid #1a1a1a; }}
    .cta {{ margin-top: 1.5rem; text-align: center; }}
    .cta a {{
      display: inline-block;
      background: #1d9e75;
      color: #fff;
      text-decoration: none;
      padding: 0.75rem 2rem;
      border-radius: 999px;
      font-size: 0.9rem;
      font-weight: 600;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="accent-bar"></div>
    <div class="card-body">
      <div class="logo">UpAlpha</div>
      <div class="trader-name">{name}</div>
      <div class="subtitle">Paper trading stats · {total_trades} trade{"s" if total_trades != 1 else ""}</div>
      <div class="stats">
        <div class="stat">
          <div class="stat-label">Win Rate</div>
          <div class="stat-value" style="color:#1d9e75">{win_rate}%</div>
        </div>
        <div class="stat">
          <div class="stat-label">Return</div>
          <div class="stat-value" style="color:{return_color}">{return_sign}{total_pnl_pct}%</div>
        </div>
        <div class="stat">
          <div class="stat-label">Best Trade</div>
          <div class="stat-value" style="color:#1d9e75;font-size:1.1rem">{best_trade}</div>
        </div>
      </div>
      <div class="footer">
        <span>up-alpha.netlify.app</span>
        <span>{created}</span>
      </div>
    </div>
  </div>
  <div class="cta">
    <a href="https://up-alpha.netlify.app">Try UpAlpha free →</a>
  </div>
</body>
</html>"""

    return HTMLResponse(content=html)
