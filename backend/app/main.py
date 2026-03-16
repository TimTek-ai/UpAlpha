from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import engine, Base
import app.models  # noqa: F401
from app.routers import users, trades, feedback, patterns


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # lightweight migration: add reason column if missing
        try:
            await conn.execute(text("ALTER TABLE trades ADD COLUMN reason TEXT"))
        except Exception:
            pass  # already exists
    yield


app = FastAPI(
    title="UpAlpha",
    description="Paper trading coach for beginners",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(trades.router)
app.include_router(feedback.router)
app.include_router(patterns.router)


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
