import asyncio
import os, hmac, hashlib, base64, json, random
from datetime import datetime, timezone, timedelta

import yfinance as yf
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import UserStats
from app.routers.users import get_current_user, User
from app.services.ai import generate

router = APIRouter(prefix="/train", tags=["train"])


# ── Fallback sample data ──────────────────────────────────────────────────────

def _generate_sample_candles(symbol: str = "SAMPLE") -> list[dict]:
    """Return 9 plausible daily candles using a seeded random walk."""
    seed = random.randint(0, 10_000)
    rng  = random.Random(seed)
    price = rng.uniform(80, 400)
    base_date = datetime.now(timezone.utc).date() - timedelta(days=30)
    # Skip weekends for realism
    trading_days = []
    d = base_date
    while len(trading_days) < 9:
        if d.weekday() < 5:
            trading_days.append(d)
        d += timedelta(days=1)

    candles = []
    for day in trading_days:
        open_ = round(price, 2)
        # Drift: slight upward bias with some volatility
        pct   = rng.gauss(0.001, 0.018)
        close = round(open_ * (1 + pct), 2)
        wick  = abs(close - open_) * rng.uniform(0.3, 1.2)
        high  = round(max(open_, close) + wick * rng.uniform(0.2, 0.8), 2)
        low   = round(min(open_, close) - wick * rng.uniform(0.2, 0.8), 2)
        candles.append({
            "date":  day.strftime("%Y-%m-%d"),
            "open":  open_,
            "high":  max(open_, close, high),
            "low":   min(open_, close, low),
            "close": close,
        })
        price = close
    return candles

_SECRET = os.getenv("SECRET_KEY", "dev-secret")

STOCKS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
    "JPM",  "JNJ",  "XOM",  "WMT",  "NFLX",  "AMD",  "CRM",
    "DIS",  "INTC", "CSCO", "ADBE", "V",     "MA",   "GS",
    "SBUX", "PYPL", "UBER", "BA",   "PFE",   "ORCL", "SQ",
]


# ── Token helpers ────────────────────────────────────────────────────────────

def _sign(payload: str) -> str:
    return hmac.new(_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:24]


def _make_token(data: dict) -> str:
    payload = base64.urlsafe_b64encode(json.dumps(data).encode()).decode()
    return f"{payload}.{_sign(payload)}"


def _verify_token(token: str) -> dict | None:
    parts = token.rsplit(".", 1)
    if len(parts) != 2:
        return None
    payload, sig = parts
    if not hmac.compare_digest(_sign(payload), sig):
        return None
    try:
        data = json.loads(base64.urlsafe_b64decode(payload))
        # Expire after 2 hours
        if datetime.now(timezone.utc).timestamp() - data.get("ts", 0) > 7200:
            return None
        return data
    except Exception:
        return None


# ── Stats helper ─────────────────────────────────────────────────────────────

async def _get_or_create_stats(user_id: int, db: AsyncSession) -> UserStats:
    result = await db.execute(select(UserStats).where(UserStats.user_id == user_id))
    stats = result.scalar_one_or_none()
    if stats is None:
        stats = UserStats(user_id=user_id, total_xp=0, train_correct=0,
                          train_total=0, train_streak=0)
        db.add(stats)
        await db.flush()
    return stats


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stats = await _get_or_create_stats(current_user.id, db)
    await db.commit()
    accuracy = round(stats.train_correct / stats.train_total * 100, 1) if stats.train_total else 0.0
    return {
        "total_xp":  stats.total_xp,
        "streak":    stats.train_streak,
        "accuracy":  accuracy,
        "correct":   stats.train_correct,
        "total":     stats.train_total,
    }


def _fetch_candles(symbol: str) -> list[dict]:
    """Blocking yfinance fetch — must be called via asyncio.to_thread."""
    df = yf.Ticker(symbol).history(period="6mo", interval="1d").dropna()
    if len(df) < 12:
        raise ValueError("not enough rows")
    max_start = len(df) - 10
    start     = random.randint(0, max_start)
    window    = df.iloc[start:start + 9]
    return [
        {
            "date":  idx.strftime("%Y-%m-%d"),
            "open":  round(float(row["Open"]),  2),
            "high":  round(float(row["High"]),  2),
            "low":   round(float(row["Low"]),   2),
            "close": round(float(row["Close"]), 2),
        }
        for idx, row in window.iterrows()
    ]


@router.get("/challenge")
async def challenge(current_user: User = Depends(get_current_user)):
    # Try up to 3 stocks; each attempt times out after 5 s so the total
    # wait before the fallback is at most ~15 s instead of hanging forever.
    for _ in range(3):
        symbol = random.choice(STOCKS)
        try:
            candles = await asyncio.wait_for(
                asyncio.to_thread(_fetch_candles, symbol),
                timeout=5.0,
            )

            visible = candles[:8]
            next_c  = candles[8]
            actual  = "bullish" if next_c["close"] >= next_c["open"] else "bearish"

            token = _make_token({
                "symbol":  symbol,
                "actual":  actual,
                "next":    next_c,
                "candles": visible,
                "ts":      datetime.now(timezone.utc).timestamp(),
            })

            return {"symbol": symbol, "candles": visible, "challenge_token": token}

        except Exception:
            continue

    # All yfinance attempts failed — use procedurally generated sample data
    symbol  = "DEMO"
    candles = _generate_sample_candles(symbol)
    visible = candles[:8]
    next_c  = candles[8]
    actual  = "bullish" if next_c["close"] >= next_c["open"] else "bearish"

    token = _make_token({
        "symbol":  symbol,
        "actual":  actual,
        "next":    next_c,
        "candles": visible,
        "ts":      datetime.now(timezone.utc).timestamp(),
    })

    return {"symbol": symbol, "candles": visible, "challenge_token": token}


class AnswerRequest(BaseModel):
    challenge_token: str
    answer: str   # "bullish" | "bearish"


@router.post("/answer")
async def answer(
    body: AnswerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.answer not in ("bullish", "bearish"):
        raise HTTPException(status_code=400, detail="Answer must be 'bullish' or 'bearish'")

    data = _verify_token(body.challenge_token)
    if data is None:
        raise HTTPException(status_code=400, detail="Invalid or expired challenge — refresh to get a new one.")

    actual    = data["actual"]
    correct   = body.answer == actual
    xp_earned = 30 if correct else 0
    symbol    = data["symbol"]
    next_c    = data["next"]
    candles   = data["candles"]

    # Persist stats
    stats = await _get_or_create_stats(current_user.id, db)
    stats.total_xp      += xp_earned
    stats.train_total   += 1
    stats.train_correct += 1 if correct else 0
    stats.train_streak   = (stats.train_streak + 1) if correct else 0
    await db.commit()
    await db.refresh(stats)

    # Build AI explanation
    last3 = candles[-3:]
    candle_summary = "  ".join(
        f"D{i+1}: O={c['open']} H={c['high']} L={c['low']} C={c['close']} "
        f"({'↑' if c['close'] >= c['open'] else '↓'})"
        for i, c in enumerate(last3)
    )
    pct  = round((next_c["close"] - next_c["open"]) / next_c["open"] * 100, 2)
    sign = "+" if pct >= 0 else ""

    prompt = (
        f"You are a trading coach. A beginner studied 8 daily candles for {symbol} "
        f"and guessed the next candle would be {body.answer}. "
        f"The last 3 visible candles were: {candle_summary}. "
        f"The actual next candle was {actual} ({sign}{pct}%). "
        f"In 2-3 sentences explain what the candles signalled and why price moved {actual}. "
        f"Plain English, no disclaimers."
    )
    explanation = await generate(prompt)

    accuracy = round(stats.train_correct / stats.train_total * 100, 1) if stats.train_total else 0.0

    return {
        "correct":     correct,
        "actual":      actual,
        "xp_earned":   xp_earned,
        "explanation": explanation,
        "next_candle": next_c,
        "stats": {
            "total_xp": stats.total_xp,
            "streak":   stats.train_streak,
            "accuracy": accuracy,
            "correct":  stats.train_correct,
            "total":    stats.train_total,
        },
    }
