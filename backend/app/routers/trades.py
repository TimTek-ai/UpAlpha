from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.models import Trade, TradeSide, TradeStatus, User
from app.routers.users import get_current_user
from app.routers.balance import get_or_create_balance
from app.services.market import get_quote
from app.services.alpaca import place_market_order

router = APIRouter(prefix="/trades", tags=["trades"])


class PlaceTradeRequest(BaseModel):
    symbol: str
    side: TradeSide
    amount: float
    reason: str | None = None


class TradeResponse(BaseModel):
    id: int
    symbol: str
    side: TradeSide
    quantity: float
    price_at_trade: float
    total_value: float
    status: TradeStatus
    alpaca_order_id: str | None
    reason: str | None
    exit_price: float | None = None
    pnl: float | None = None
    closed_at: str | None = None
    created_at: str | None = None

    model_config = {"from_attributes": True}


@router.post("/", response_model=TradeResponse, status_code=201)
async def place_trade(
    body: PlaceTradeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        quote = get_quote(body.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    price = quote["price"]
    qty = round(body.amount / price, 6)
    trade_value = round(qty * price, 2)

    # ── Balance check ──────────────────────────────────────
    bal = await get_or_create_balance(current_user.id, db)
    if body.side == TradeSide.buy and bal.cash < trade_value:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. You have £{bal.cash:,.2f} but this trade costs £{trade_value:,.2f}.",
        )

    try:
        order = place_market_order(body.symbol, qty, body.side.value)
        alpaca_id = order["alpaca_order_id"]
        status = TradeStatus.filled
    except Exception:
        alpaca_id = None
        status = TradeStatus.failed

    # ── Update balance ─────────────────────────────────────
    from datetime import datetime, timezone
    if body.side == TradeSide.buy:
        bal.cash = round(bal.cash - trade_value, 2)
    else:
        bal.cash = round(bal.cash + trade_value, 2)
    bal.updated_at = datetime.now(timezone.utc)

    trade = Trade(
        user_id=current_user.id,
        symbol=body.symbol.upper(),
        side=body.side,
        quantity=qty,
        price_at_trade=price,
        total_value=round(qty * price, 2),
        alpaca_order_id=alpaca_id,
        status=status,
        reason=body.reason,
    )
    db.add(trade)
    await db.commit()
    await db.refresh(trade)
    return _serialize(trade)


@router.get("/", response_model=list[TradeResponse])
async def list_trades(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Trade)
        .where(Trade.user_id == current_user.id)
        .order_by(Trade.created_at.desc())
    )
    return [_serialize(t) for t in result.scalars().all()]


@router.get("/{trade_id}", response_model=TradeResponse)
async def get_trade(
    trade_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Trade).where(Trade.id == trade_id, Trade.user_id == current_user.id)
    )
    trade = result.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    return _serialize(trade)


def _serialize(trade: Trade) -> dict:
    return {
        "id": trade.id,
        "symbol": trade.symbol,
        "side": trade.side,
        "quantity": trade.quantity,
        "price_at_trade": trade.price_at_trade,
        "total_value": trade.total_value,
        "status": trade.status,
        "alpaca_order_id": trade.alpaca_order_id,
        "reason": trade.reason if hasattr(trade, "reason") else None,
        "exit_price": trade.exit_price,
        "pnl": trade.pnl,
        "closed_at": trade.closed_at.isoformat() if trade.closed_at else None,
        "created_at": trade.created_at.isoformat() if trade.created_at else None,
    }


@router.post("/{trade_id}/close", response_model=TradeResponse)
async def close_trade(
    trade_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone

    result = await db.execute(
        select(Trade).where(Trade.id == trade_id, Trade.user_id == current_user.id)
    )
    trade = result.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    if trade.side != TradeSide.buy:
        raise HTTPException(status_code=400, detail="Only buy trades can be closed")
    if trade.exit_price is not None:
        raise HTTPException(status_code=400, detail="Trade is already closed")

    try:
        quote = get_quote(trade.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    exit_price = quote["price"]
    exit_value = round(exit_price * trade.quantity, 2)
    pnl = round((exit_price - trade.price_at_trade) * trade.quantity, 2)

    trade.exit_price = exit_price
    trade.pnl = pnl
    trade.closed_at = datetime.now(timezone.utc)

    bal = await get_or_create_balance(current_user.id, db)
    bal.cash = round(bal.cash + exit_value, 2)
    bal.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(trade)
    return _serialize(trade)
