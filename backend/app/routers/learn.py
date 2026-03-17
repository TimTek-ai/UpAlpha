"""
Learn endpoints — Candlestick pattern quiz + Strategy scenario quiz
"""
import asyncio, os, hmac, hashlib, base64, json, random
from datetime import datetime, timezone

import yfinance as yf
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import UserStats
from app.routers.users import get_current_user, User
from app.services.ai import generate

router  = APIRouter(prefix="/learn", tags=["learn"])
_SECRET = os.getenv("SECRET_KEY", "dev-secret")

STOCKS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
    "JPM",  "JNJ",  "XOM",   "WMT",  "NFLX", "AMD",  "CRM",
    "DIS",  "SBUX", "V",     "MA",   "GS",   "ADBE",
]

# ── Pattern definitions ───────────────────────────────────────────────────────

PATTERNS = {
    "Doji": {
        "highlight": 1,
        "signal": "market indecision",
        "description": "Open ≈ Close, forming a cross. Neither buyers nor sellers won the session — a potential reversal is near.",
    },
    "Hammer": {
        "highlight": 1,
        "signal": "bullish reversal",
        "description": "Small body near the top, long lower wick (≥2× body). Buyers pushed price back up from the lows — found after a downtrend.",
    },
    "Shooting Star": {
        "highlight": 1,
        "signal": "bearish reversal",
        "description": "Small body near the bottom, long upper wick (≥2× body). Sellers pushed price back down from the highs — found after an uptrend.",
    },
    "Bullish Engulfing": {
        "highlight": 2,
        "signal": "strong bullish reversal",
        "description": "Large green candle fully engulfs the previous red candle. Bulls completely overtook bears.",
    },
    "Bearish Engulfing": {
        "highlight": 2,
        "signal": "strong bearish reversal",
        "description": "Large red candle fully engulfs the previous green candle. Bears completely overtook bulls.",
    },
    "Spinning Top": {
        "highlight": 1,
        "signal": "indecision / pause",
        "description": "Small body with roughly equal upper and lower wicks. Both sides tested extremes — the trend may be losing steam.",
    },
}

ALL_PATTERN_NAMES = list(PATTERNS.keys())

# ── Strategy scenarios ────────────────────────────────────────────────────────

STRATEGIES = {
    "rsi": {
        "name": "RSI Mean Reversion",
        "description": "Uses the Relative Strength Index to spot overbought (>70) and oversold (<30) conditions and trade the reversion to the mean.",
        "difficulty": "Beginner",
        "risk": "Low–Medium",
        "frequency": "Daily",
        "scenarios": [
            {
                "setup": "NVDA has fallen 15% over 5 days. The 14-day RSI just printed 26 — well below the 30 oversold level. Price is near a key support zone.",
                "question": "What does RSI Mean Reversion signal here?",
                "choices": [
                    "Buy — RSI below 30 signals oversold, expect a bounce",
                    "Sell — strong downward momentum, ride the trend",
                    "Short the stock — it's clearly breaking down further",
                    "Wait until RSI reaches 10 before entering",
                ],
                "correct": 0,
            },
            {
                "setup": "AAPL has rallied 18% in 12 days after strong earnings. The 14-day RSI is now at 76 and still climbing.",
                "question": "What does RSI Mean Reversion signal?",
                "choices": [
                    "Buy more — strong momentum, it will go even higher",
                    "Sell or trim position — RSI above 70 signals overbought",
                    "Add a tight stop-loss and hold the full position",
                    "Short immediately with maximum position size",
                ],
                "correct": 1,
            },
            {
                "setup": "TSLA's RSI has been between 45–55 for three weeks. Price is in a tight sideways range with no clear trend.",
                "question": "What does the RSI reading suggest?",
                "choices": [
                    "Buy aggressively — RSI near 50 is the perfect entry",
                    "Sell everything — neutral RSI means the trend is finished",
                    "No clear signal — RSI 40–60 is neutral; wait for an extreme",
                    "Short — sideways action always leads to a breakdown",
                ],
                "correct": 2,
            },
        ],
    },
    "momentum": {
        "name": "Momentum Breakout",
        "description": "Enters when price breaks above resistance (or below support) on high volume, then rides the new trend.",
        "difficulty": "Intermediate",
        "risk": "Medium",
        "frequency": "Weekly",
        "scenarios": [
            {
                "setup": "META has consolidated between $480–$500 for 6 weeks. Today it closes at $503 on 3× average volume with no major news catalyst.",
                "question": "What does a Momentum Breakout trader do?",
                "choices": [
                    "Buy the breakout — price closed above resistance on strong volume",
                    "Sell — it's overextended after 6 weeks of consolidation",
                    "Wait for a pullback to $500 before entering",
                    "Short — breakouts above old resistance always reverse quickly",
                ],
                "correct": 0,
            },
            {
                "setup": "AMD breaks above the $180 resistance level but on only 40% of average volume. Price moves up $4 in one session.",
                "question": "How should a Momentum Breakout trader view this?",
                "choices": [
                    "Strong buy — price broke resistance, enter with full size immediately",
                    "Suspicious — low-volume breakouts often fail; wait for volume confirmation",
                    "Sell short — low-volume breakouts always reverse the same day",
                    "Volume doesn't matter — enter with maximum position size",
                ],
                "correct": 1,
            },
            {
                "setup": "GOOGL breaks to a 3-month high on strong volume. Two days later it pulls back exactly to the old resistance level, which is now acting as support.",
                "question": "What is the best Momentum Breakout action on this pullback?",
                "choices": [
                    "Sell — the breakout failed since price pulled back",
                    "Add to position — a retest of breakout level as support is a classic re-entry",
                    "Do nothing — wait for a new 3-month high before acting",
                    "Short — stocks always fall back to pre-breakout levels eventually",
                ],
                "correct": 1,
            },
        ],
    },
    "ma_cross": {
        "name": "Moving Average Cross",
        "description": "Uses the crossover of the 20-day MA over the 50-day MA to identify trend changes — golden cross (bullish) and death cross (bearish).",
        "difficulty": "Beginner",
        "risk": "Low",
        "frequency": "Monthly",
        "scenarios": [
            {
                "setup": "MSFT's 20-day MA just crossed above its 50-day MA — the first golden cross in 4 months. Price is trending up and volume is above average.",
                "question": "What signal does a Moving Average Cross strategy generate?",
                "choices": [
                    "Sell — 20-day MA above 50-day is a bearish crossover signal",
                    "Buy — the golden cross signals building bullish momentum",
                    "Wait for the 200-day MA to confirm before taking action",
                    "Short — MA crossovers always reverse within 2 days",
                ],
                "correct": 1,
            },
            {
                "setup": "BA's 20-day MA crosses below its 50-day MA after three weeks of falling prices. Volume has been above average throughout the decline.",
                "question": "What does this 'death cross' signal?",
                "choices": [
                    "Buy — price is deeply oversold after the multi-week decline",
                    "Hold and ignore it — moving averages are lagging indicators",
                    "Sell or avoid — the death cross signals bearish momentum building",
                    "Double your position — it's a mean-reversion opportunity",
                ],
                "correct": 2,
            },
            {
                "setup": "JPM shows a golden cross (20 MA crosses above 50 MA) but the S&P 500 is in a confirmed downtrend, down 15% from its peak.",
                "question": "How should a MA Cross trader handle this conflicting signal?",
                "choices": [
                    "Buy full size — a golden cross always works regardless of market conditions",
                    "Ignore it entirely — individual stock signals never work in bear markets",
                    "Reduce size or wait — trading against the market trend increases risk",
                    "Short JPM — the market trend always cancels individual stock signals",
                ],
                "correct": 2,
            },
        ],
    },
}

# ── Token helpers ─────────────────────────────────────────────────────────────

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
        if datetime.now(timezone.utc).timestamp() - data.get("ts", 0) > 7200:
            return None
        return data
    except Exception:
        return None

# ── Stats helper ──────────────────────────────────────────────────────────────

async def _get_or_create_stats(user_id: int, db: AsyncSession) -> UserStats:
    result = await db.execute(select(UserStats).where(UserStats.user_id == user_id))
    stats  = result.scalar_one_or_none()
    if stats is None:
        stats = UserStats(user_id=user_id)
        db.add(stats)
        await db.flush()
    return stats

# ── Pattern detection ─────────────────────────────────────────────────────────

def _detect(candles: list[dict]) -> str | None:
    last = candles[-1]
    prev = candles[-2] if len(candles) >= 2 else None

    body  = abs(last["close"] - last["open"])
    rng   = last["high"] - last["low"]
    if rng < 0.001:
        return None

    upper = last["high"] - max(last["open"], last["close"])
    lower = min(last["open"], last["close"]) - last["low"]

    if body / rng < 0.12:
        return "Doji"
    if body / rng < 0.38 and upper > body * 0.3 and lower > body * 0.3:
        return "Spinning Top"
    if lower >= 1.8 * body and upper <= body * 0.8:
        return "Hammer"
    if upper >= 1.8 * body and lower <= body * 0.8:
        return "Shooting Star"

    if prev:
        if (last["close"] > last["open"] and prev["close"] < prev["open"]
                and last["open"] <= prev["close"] and last["close"] >= prev["open"]):
            return "Bullish Engulfing"
        if (last["close"] < last["open"] and prev["close"] > prev["open"]
                and last["open"] >= prev["close"] and last["close"] <= prev["open"]):
            return "Bearish Engulfing"

    return None


def _scan_sync(stocks: list[str]) -> tuple[str, list, str] | None:
    """Blocking yfinance calls — must be called via asyncio.to_thread."""
    pool = stocks.copy()
    random.shuffle(pool)

    for symbol in pool[:6]:
        try:
            df = yf.Ticker(symbol).history(period="3mo", interval="1d").dropna()
            if len(df) < 10:
                continue

            indices = list(range(4, len(df) - 1))
            random.shuffle(indices)

            for end in indices[:30]:
                window  = df.iloc[end - 4: end + 1]
                candles = [
                    {
                        "date":  str(idx.date()),
                        "open":  round(float(row["Open"]),  2),
                        "high":  round(float(row["High"]),  2),
                        "low":   round(float(row["Low"]),   2),
                        "close": round(float(row["Close"]), 2),
                    }
                    for idx, row in window.iterrows()
                ]
                pattern = _detect(candles)
                if pattern:
                    return symbol, candles, pattern
        except Exception:
            continue

    return None

# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stats = await _get_or_create_stats(current_user.id, db)
    await db.commit()
    return {
        "total_xp":                  getattr(stats, "total_xp", 0),
        "learn_candlestick_correct": getattr(stats, "learn_candlestick_correct", 0),
        "learn_candlestick_total":   getattr(stats, "learn_candlestick_total",   0),
        "learn_strategy_correct":    getattr(stats, "learn_strategy_correct",    0),
        "learn_strategy_total":      getattr(stats, "learn_strategy_total",      0),
    }


@router.get("/candlestick/challenge")
async def candlestick_challenge(current_user: User = Depends(get_current_user)):
    found = await asyncio.to_thread(_scan_sync, STOCKS)
    if not found:
        raise HTTPException(500, "Could not find a clear pattern — try again.")

    symbol, candles, pattern = found

    wrongs  = [p for p in ALL_PATTERN_NAMES if p != pattern]
    choices = random.sample(wrongs, 3) + [pattern]
    random.shuffle(choices)

    token = _make_token({
        "kind":    "candlestick",
        "symbol":  symbol,
        "pattern": pattern,
        "ts":      datetime.now(timezone.utc).timestamp(),
    })

    return {
        "symbol":          symbol,
        "candles":         candles,
        "choices":         choices,
        "highlight_last":  PATTERNS[pattern]["highlight"],
        "challenge_token": token,
    }


class CandlestickAnswerReq(BaseModel):
    challenge_token: str
    answer: str


@router.post("/candlestick/answer")
async def candlestick_answer(
    body: CandlestickAnswerReq,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = _verify_token(body.challenge_token)
    if not data or data.get("kind") != "candlestick":
        raise HTTPException(400, "Invalid or expired challenge token.")

    pattern   = data["pattern"]
    correct   = body.answer == pattern
    xp_earned = 20 if correct else 0
    info      = PATTERNS[pattern]

    stats = await _get_or_create_stats(current_user.id, db)
    stats.total_xp                  += xp_earned
    stats.learn_candlestick_total   += 1
    stats.learn_candlestick_correct += 1 if correct else 0
    await db.commit()

    prompt = (
        f"You are a trading coach. A beginner {'correctly' if correct else 'incorrectly'} "
        f"identified a {pattern} pattern on {data['symbol']}. "
        f"In 2 sentences, explain what a {pattern} looks like visually and what it signals ({info['signal']}). "
        f"Plain English. No disclaimers."
    )
    explanation = await generate(prompt)

    return {
        "correct":     correct,
        "pattern":     pattern,
        "xp_earned":   xp_earned,
        "signal":      info["signal"],
        "description": info["description"],
        "explanation": explanation,
    }


@router.get("/strategy/challenge/{strategy_id}")
async def strategy_challenge(
    strategy_id: str,
    current_user: User = Depends(get_current_user),
):
    if strategy_id not in STRATEGIES:
        raise HTTPException(404, "Unknown strategy.")

    s       = STRATEGIES[strategy_id]
    idx     = random.randint(0, len(s["scenarios"]) - 1)
    scenario = s["scenarios"][idx]

    token = _make_token({
        "kind":         "strategy",
        "strategy_id":  strategy_id,
        "scenario_idx": idx,
        "correct":      scenario["correct"],
        "ts":           datetime.now(timezone.utc).timestamp(),
    })

    return {
        "strategy_name":   s["name"],
        "setup":           scenario["setup"],
        "question":        scenario["question"],
        "choices":         scenario["choices"],
        "challenge_token": token,
    }


class StrategyAnswerReq(BaseModel):
    challenge_token: str
    answer_idx: int


@router.post("/strategy/answer")
async def strategy_answer(
    body: StrategyAnswerReq,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = _verify_token(body.challenge_token)
    if not data or data.get("kind") != "strategy":
        raise HTTPException(400, "Invalid or expired challenge token.")

    correct_idx    = data["correct"]
    correct        = body.answer_idx == correct_idx
    xp_earned      = 25 if correct else 0
    strategy_id    = data["strategy_id"]
    scenario       = STRATEGIES[strategy_id]["scenarios"][data["scenario_idx"]]
    correct_choice = scenario["choices"][correct_idx]

    stats = await _get_or_create_stats(current_user.id, db)
    stats.total_xp               += xp_earned
    stats.learn_strategy_total   += 1
    stats.learn_strategy_correct += 1 if correct else 0
    await db.commit()

    prompt = (
        f"You are a trading coach. A beginner is learning the {STRATEGIES[strategy_id]['name']} strategy. "
        f"Scenario: '{scenario['setup']}' "
        f"The correct action was: '{correct_choice}'. "
        f"The student {'answered correctly' if correct else 'got it wrong'}. "
        f"In 2–3 sentences explain why '{correct_choice}' is the right move for this strategy. "
        f"Plain English. No disclaimers."
    )
    explanation = await generate(prompt)

    return {
        "correct":        correct,
        "correct_idx":    correct_idx,
        "correct_choice": correct_choice,
        "xp_earned":      xp_earned,
        "explanation":    explanation,
    }
