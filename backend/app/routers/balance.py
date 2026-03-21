from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.database import get_db
from app.models import UserBalance, User
from app.routers.users import get_current_user

router = APIRouter(prefix="/balance", tags=["balance"])

STARTING_BALANCE = 100_000.0


async def get_or_create_balance(user_id: int, db: AsyncSession) -> UserBalance:
    """Return the user's balance row, creating it with £100k if missing."""
    result = await db.execute(select(UserBalance).where(UserBalance.user_id == user_id))
    bal = result.scalar_one_or_none()
    if bal is None:
        bal = UserBalance(
            user_id=user_id,
            cash=STARTING_BALANCE,
            starting_balance=STARTING_BALANCE,
        )
        db.add(bal)
        await db.commit()
        await db.refresh(bal)
    return bal


@router.get("")
async def get_balance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bal = await get_or_create_balance(current_user.id, db)
    pnl = round(bal.cash - bal.starting_balance, 2)
    pnl_pct = round(pnl / bal.starting_balance * 100, 2)
    return {
        "cash": round(bal.cash, 2),
        "starting_balance": round(bal.starting_balance, 2),
        "pnl": pnl,
        "pnl_pct": pnl_pct,
    }
