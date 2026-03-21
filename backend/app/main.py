from contextlib import asynccontextmanager
import asyncio
import logging
import logging.config

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from dotenv import load_dotenv
import os

logging.config.dictConfig({
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {"format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "default"},
    },
    "root": {"level": "INFO", "handlers": ["console"]},
})

load_dotenv()

from app.database import engine, Base
import app.models  # noqa: F401
from app.routers import users, trades, feedback, patterns, portfolio, dashboard, train, learn, balance, leaderboard, share


_MIGRATIONS = [
    "ALTER TABLE trades ADD COLUMN reason TEXT",
    "ALTER TABLE user_stats ADD COLUMN learn_candlestick_correct INTEGER DEFAULT 0",
    "ALTER TABLE user_stats ADD COLUMN learn_candlestick_total INTEGER DEFAULT 0",
    "ALTER TABLE user_stats ADD COLUMN learn_strategy_correct INTEGER DEFAULT 0",
    "ALTER TABLE user_stats ADD COLUMN learn_strategy_total INTEGER DEFAULT 0",
    "ALTER TABLE trades ADD COLUMN exit_price REAL",
    "ALTER TABLE trades ADD COLUMN pnl REAL",
    "ALTER TABLE trades ADD COLUMN closed_at DATETIME",
]

log = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create any tables that don't exist yet
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Each migration runs in its own transaction so that a "column already
    # exists" failure on PostgreSQL cannot abort the rest of the batch.
    for stmt in _MIGRATIONS:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(stmt))
            log.info("Migration applied: %s", stmt[:60])
        except Exception as e:
            log.debug("Migration skipped (%s): %s", type(e).__name__, stmt[:60])

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
        return await asyncio.wait_for(
            asyncio.to_thread(get_quote, symbol),
            timeout=10.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=503, detail=f"Price fetch timed out for {symbol}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Market data error: {type(e).__name__}: {e}")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "upalpha-backend"}
