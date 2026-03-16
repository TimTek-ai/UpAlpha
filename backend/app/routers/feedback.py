from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.models import Trade, Feedback, User
from app.routers.users import get_current_user
from app.services.feedback import generate_feedback

router = APIRouter(prefix="/trades", tags=["feedback"])


class FeedbackResponse(BaseModel):
    id: int
    trade_id: int
    ai_text: str

    model_config = {"from_attributes": True}


@router.post("/{trade_id}/feedback", response_model=FeedbackResponse, status_code=201)
async def request_feedback(
    trade_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify trade belongs to current user
    result = await db.execute(
        select(Trade).where(Trade.id == trade_id, Trade.user_id == current_user.id)
    )
    trade = result.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")

    # Return existing feedback if already generated
    existing = await db.execute(
        select(Feedback).where(Feedback.trade_id == trade_id)
    )
    if fb := existing.scalar_one_or_none():
        return fb

    # Generate new feedback from Ollama
    ai_text = await generate_feedback({
        "symbol": trade.symbol,
        "side": trade.side.value,
        "quantity": trade.quantity,
        "price_at_trade": trade.price_at_trade,
        "total_value": trade.total_value,
    })

    feedback = Feedback(trade_id=trade_id, ai_text=ai_text)
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)
    return feedback


@router.get("/{trade_id}/feedback", response_model=FeedbackResponse)
async def get_feedback(
    trade_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Trade).where(Trade.id == trade_id, Trade.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Trade not found")

    result = await db.execute(
        select(Feedback).where(Feedback.trade_id == trade_id)
    )
    fb = result.scalar_one_or_none()
    if not fb:
        raise HTTPException(status_code=404, detail="No feedback yet — POST to generate it")
    return fb
