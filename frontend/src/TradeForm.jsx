import { useState, useEffect } from "react";
import api from "./api";

export default function TradeForm({ onTradePlaced }) {
  const [symbol, setSymbol] = useState("");
  const [amount, setAmount] = useState("");
  const [side, setSide] = useState("buy");
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Debounced quote fetch when symbol changes
  useEffect(() => {
    if (symbol.length < 1) { setQuote(null); return; }
    const timer = setTimeout(async () => {
      setQuoteLoading(true);
      try {
        const { data } = await api.get(`/quotes/${symbol}`);
        setQuote(data);
        setError("");
      } catch {
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [symbol]);

  const estimatedShares = quote && amount ? (parseFloat(amount) / quote.price).toFixed(4) : null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data: trade } = await api.post("/trades/", {
        symbol: symbol.toUpperCase(),
        side,
        amount: parseFloat(amount),
      });
      onTradePlaced(trade);
      setSymbol(""); setAmount(""); setQuote(null);
    } catch (err) {
      setError(err.response?.data?.detail || "Trade failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <h2>Place a Trade</h2>
      <form onSubmit={handleSubmit}>
        <div className="field-row">
          <div className="field">
            <label>Stock symbol</label>
            <input
              value={symbol}
              onChange={e => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. AAPL"
              maxLength={6}
              required
            />
          </div>

          <div className="field">
            <label>Amount (USD)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 500"
              required
            />
          </div>
        </div>

        {quoteLoading && <p className="muted">Fetching price…</p>}
        {quote && (
          <div className="quote-box">
            <span className="quote-symbol">{quote.symbol}</span>
            <span className="quote-price">${quote.price.toFixed(2)}</span>
            {estimatedShares && <span className="muted">≈ {estimatedShares} shares</span>}
          </div>
        )}

        <div className="side-toggle">
          <button type="button" className={side === "buy" ? "side-btn buy active" : "side-btn buy"} onClick={() => setSide("buy")}>Buy</button>
          <button type="button" className={side === "sell" ? "side-btn sell active" : "side-btn sell"} onClick={() => setSide("sell")}>Sell</button>
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn-primary" disabled={submitting || !quote}>
          {submitting ? "Placing trade…" : `${side === "buy" ? "Buy" : "Sell"} ${symbol || "…"}`}
        </button>
      </form>
    </div>
  );
}
