from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest
from alpaca.trading.enums import OrderSide, TimeInForce
from dotenv import load_dotenv
import os

load_dotenv()

_client: TradingClient | None = None


def get_client() -> TradingClient:
    global _client
    if _client is None:
        api_key = os.getenv("ALPACA_API_KEY")
        secret_key = os.getenv("ALPACA_SECRET_KEY")
        if not api_key or not secret_key:
            raise RuntimeError("ALPACA_API_KEY and ALPACA_SECRET_KEY must be set in .env")
        _client = TradingClient(api_key, secret_key, paper=True)
    return _client


def place_market_order(symbol: str, qty: float, side: str) -> dict:
    client = get_client()
    order_side = OrderSide.BUY if side == "buy" else OrderSide.SELL
    req = MarketOrderRequest(
        symbol=symbol.upper(),
        qty=qty,
        side=order_side,
        time_in_force=TimeInForce.DAY,
    )
    order = client.submit_order(req)
    return {
        "alpaca_order_id": str(order.id),
        "status": str(order.status),
        "symbol": str(order.symbol),
        "qty": float(order.qty),
        "side": str(order.side),
    }
