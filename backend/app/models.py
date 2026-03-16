from sqlalchemy import Integer, String, Float, DateTime, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone
import enum

from app.database import Base


class TradeSide(str, enum.Enum):
    buy = "buy"
    sell = "sell"


class TradeStatus(str, enum.Enum):
    pending = "pending"
    filled = "filled"
    failed = "failed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    trades: Mapped[list["Trade"]] = relationship("Trade", back_populates="user")


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    symbol: Mapped[str] = mapped_column(String, nullable=False)
    side: Mapped[TradeSide] = mapped_column(Enum(TradeSide), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    price_at_trade: Mapped[float] = mapped_column(Float, nullable=False)
    total_value: Mapped[float] = mapped_column(Float, nullable=False)
    reason: Mapped[str | None] = mapped_column(String, nullable=True)
    alpaca_order_id: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[TradeStatus] = mapped_column(
        Enum(TradeStatus), default=TradeStatus.pending
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship("User", back_populates="trades")
    feedback: Mapped["Feedback | None"] = relationship("Feedback", back_populates="trade", uselist=False)


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    trade_id: Mapped[int] = mapped_column(Integer, ForeignKey("trades.id"), nullable=False)
    ai_text: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    trade: Mapped["Trade"] = relationship("Trade", back_populates="feedback")
