from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from dotenv import load_dotenv
import os

load_dotenv()

from app.database import engine, Base
import app.models  # noqa: F401
from app.routers import users, trades, feedback, patterns, portfolio, dashboard, train, learn, balance, leaderboard, share


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for stmt in [
            "ALTER TABLE trades ADD COLUMN reason TEXT",
            "ALTER TABLE user_stats ADD COLUMN learn_candlestick_correct INTEGER DEFAULT 0",
            "ALTER TABLE user_stats ADD COLUMN learn_candlestick_total INTEGER DEFAULT 0",
            "ALTER TABLE user_stats ADD COLUMN learn_strategy_correct INTEGER DEFAULT 0",
            "ALTER TABLE user_stats ADD COLUMN learn_strategy_total INTEGER DEFAULT 0",
            "ALTER TABLE trades ADD COLUMN exit_price REAL",
            "ALTER TABLE trades ADD COLUMN pnl REAL",
            "ALTER TABLE trades ADD COLUMN closed_at DATETIME",
        ]:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass
    yield


app = FastAPI(
    title="UpAlpha",
    description="Paper trading coach for beginners",
    version="0.1.0",
    lifespan=lifespan,
)

_raw_origins  = os.getenv("ALLOWED_ORIGINS", "*")
_allow_all    = _raw_origins.strip() == "*"
allowed_origins = ["*"] if _allow_all else _raw_origins.split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=not _allow_all,   # credentials not allowed with wildcard origin
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(trades.router)
app.include_router(feedback.router)
app.include_router(patterns.router)
app.include_router(portfolio.router)
app.include_router(dashboard.router)
app.include_router(train.router)
app.include_router(learn.router)
app.include_router(balance.router)
app.include_router(leaderboard.router)
app.include_router(share.router)


@app.get("/quotes/{symbol}")
async def quote(symbol: str):
    from app.services.market import get_quote
    from fastapi import HTTPException
    try:
        return get_quote(symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok", "service": "upalpha-backend"}
