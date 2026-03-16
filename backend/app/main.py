from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from dotenv import load_dotenv
import os

load_dotenv()

from app.database import engine, Base
import app.models  # noqa: F401
from app.routers import users, trades, feedback, patterns, portfolio


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        try:
            await conn.execute(text("ALTER TABLE trades ADD COLUMN reason TEXT"))
        except Exception:
            pass
    yield


app = FastAPI(
    title="UpAlpha",
    description="Paper trading coach for beginners",
    version="0.1.0",
    lifespan=lifespan,
)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(trades.router)
app.include_router(feedback.router)
app.include_router(patterns.router)
app.include_router(portfolio.router)


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
