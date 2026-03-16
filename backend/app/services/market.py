import yfinance as yf


def get_current_price(symbol: str) -> float:
    ticker = yf.Ticker(symbol.upper())
    price = ticker.fast_info.last_price
    if not price:
        raise ValueError(f"Could not fetch price for {symbol!r}")
    return round(float(price), 2)


def get_quote(symbol: str) -> dict:
    ticker = yf.Ticker(symbol.upper())
    info = ticker.fast_info
    price = info.last_price
    if not price:
        raise ValueError(f"Could not fetch price for {symbol!r}")

    prev = getattr(info, "previous_close", None)
    change_pct = round((float(price) - float(prev)) / float(prev) * 100, 2) if prev else None

    return {
        "symbol": symbol.upper(),
        "price": round(float(price), 2),
        "change_pct": change_pct,
        "currency": getattr(info, "currency", "USD"),
    }
