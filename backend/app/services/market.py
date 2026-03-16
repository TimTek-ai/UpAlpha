import yfinance as yf


def get_current_price(symbol: str) -> float:
    ticker = yf.Ticker(symbol.upper())
    info = ticker.fast_info
    price = info.last_price
    if not price:
        raise ValueError(f"Could not fetch price for {symbol!r}")
    return round(float(price), 2)


def get_quote(symbol: str) -> dict:
    ticker = yf.Ticker(symbol.upper())
    info = ticker.fast_info
    price = info.last_price
    if not price:
        raise ValueError(f"Could not fetch price for {symbol!r}")
    return {
        "symbol": symbol.upper(),
        "price": round(float(price), 2),
        "currency": getattr(info, "currency", "USD"),
    }
