from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Trade, User
from app.routers.users import get_current_user
from app.services.ai import generate

router = APIRouter(prefix="/patterns", tags=["patterns"])


@router.get("/")
async def get_patterns(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Trade)
        .where(Trade.user_id == current_user.id)
        .order_by(Trade.created_at.desc())
        .limit(20)
    )
    trades = result.scalars().all()

    if len(trades) < 2:
        return {"text": "Place at least 2 trades and I'll start spotting patterns in your behaviour."}

    summary_lines = []
    for t in trades:
        reason_part = f' (reason: "{t.reason}")' if getattr(t, "reason", None) else ""
        summary_lines.append(
            f"- {t.side.value.upper()} {t.symbol} ${t.total_value:.0f}{reason_part}"
        )

    prompt = f"""You are UpAlpha, a trading coach for beginners.

Here are a trader's recent paper trades:
{chr(10).join(summary_lines)}

In 2-3 short paragraphs, identify patterns in their behaviour. Look for things like:
- Do they prefer buying or selling?
- Do they concentrate on certain stocks?
- Are their reasons emotional or analytical?
- What one habit should they change?

Be specific, encouraging, and use plain English. No bullet points."""

    return {"text": await generate(prompt)}
