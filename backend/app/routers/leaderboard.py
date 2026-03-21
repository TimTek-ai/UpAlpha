from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, UserBalance, Trade, TradeSide
from app.routers.users import get_current_user

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("")
async def get_leaderboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Fetch all users who have a balance row
    bal_result = await db.execute(select(UserBalance))
    balances = {b.user_id: b for b in bal_result.scalars().all()}

    if not balances:
        return {"entries": [], "current_user_rank": None}

    user_ids = list(balances.keys())

    # Fetch all users
    user_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users = {u.id: u for u in user_result.scalars().all()}

    # Fetch all open buy trades (side=buy, exit_price=null) for these users
    trades_result = await db.execute(
        select(Trade).where(
            Trade.user_id.in_(user_ids),
            Trade.side == TradeSide.buy,
            Trade.exit_price.is_(None),
        )
    )
    open_trades = trades_result.scalars().all()

    # Sum open position cost basis per user
    open_cost: dict[int, float] = {}
    for t in open_trades:
        open_cost[t.user_id] = open_cost.get(t.user_id, 0.0) + t.total_value

    # Build entries
    entries = []
    for uid, bal in balances.items():
        user = users.get(uid)
        if not user:
            continue
        portfolio_value = round(bal.cash + open_cost.get(uid, 0.0), 2)
        pnl = round(portfolio_value - bal.starting_balance, 2)
        return_pct = round(pnl / bal.starting_balance * 100, 2) if bal.starting_balance else 0.0

        # Display name: part before @ in email
        name = user.email.split("@")[0]

        entries.append({
            "user_id": uid,
            "name": name,
            "starting_balance": round(bal.starting_balance, 2),
            "portfolio_value": portfolio_value,
            "pnl": pnl,
            "return_pct": return_pct,
            "is_current_user": uid == current_user.id,
        })

    # Sort by return_pct descending, take top 10
    entries.sort(key=lambda x: x["return_pct"], reverse=True)

    # Find current user's rank across all users (before truncating to 10)
    current_user_rank = None
    for i, e in enumerate(entries):
        if e["is_current_user"]:
            current_user_rank = i + 1
            break

    return {
        "entries": entries[:10],
        "current_user_rank": current_user_rank,
        "total_traders": len(entries),
    }
