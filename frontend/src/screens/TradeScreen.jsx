import { useState, useEffect } from "react";
import api from "../api";

const STOCKS = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "NVDA", name: "NVIDIA Corp" },
  { symbol: "MSFT", name: "Microsoft" },
];

// ── Step 1: Pick a stock ──────────────────────────────
function StockPicker({ onSelect }) {
  const [quotes, setQuotes] = useState({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    STOCKS.forEach(({ symbol }) => {
      api.get(`/quotes/${symbol}`)
        .then(({ data }) => setQuotes(q => ({ ...q, [symbol]: data })))
        .catch(() => {});
    });
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    if (search.trim()) onSelect({ symbol: search.trim().toUpperCase(), name: search.trim().toUpperCase() });
  }

  return (
    <>
      <p className="screen-title">Pick a stock</p>
      <form onSubmit={handleSearch}>
        <input
          className="search-bar"
          placeholder="Search ticker (e.g. AMZN)…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </form>
      <div className="stock-grid">
        {STOCKS.map(({ symbol, name }) => {
          const q = quotes[symbol];
          return (
            <button key={symbol} className="stock-card" onClick={() => onSelect({ symbol, name, quote: q })}>
              <div className="ticker">{symbol}</div>
              <div className="stock-name">{name}</div>
              <div className="price">{q ? `$${q.price.toFixed(2)}` : "—"}</div>
              {q?.change_pct != null && (
                <div className={`change ${q.change_pct >= 0 ? "pos" : "neg"}`}>
                  {q.change_pct >= 0 ? "+" : ""}{q.change_pct.toFixed(2)}%
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ── Step 2: Make a trade ─────────────────────────────
function MakeTradeForm({ stock, onBack, onDone }) {
  const [side, setSide] = useState("buy");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [quote, setQuote] = useState(stock.quote || null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!quote) {
      api.get(`/quotes/${stock.symbol}`).then(({ data }) => setQuote(data)).catch(() => {});
    }
  }, [stock.symbol]);

  const shares = quote && amount ? (parseFloat(amount) / quote.price).toFixed(4) : null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data: trade } = await api.post("/trades/", {
        symbol: stock.symbol,
        side,
        amount: parseFloat(amount),
        reason: reason || null,
      });
      onDone(trade, quote);
    } catch (err) {
      setError(err.response?.data?.detail || "Trade failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button className="back-btn" onClick={onBack}>← Back</button>

      <div className="selected-stock card" style={{ marginBottom: "1rem" }}>
        <div>
          <span className="sym">{stock.symbol}</span>
          <span style={{ marginLeft: "0.5rem", fontSize: "0.82rem", color: "var(--muted)" }}>{stock.name}</span>
        </div>
        <span className="pr">{quote ? `$${quote.price.toFixed(2)}` : "…"}</span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="toggle-row" style={{ marginBottom: "1rem" }}>
          <button type="button" className={`toggle-btn buy ${side === "buy" ? "active" : ""}`} onClick={() => setSide("buy")}>Buy</button>
          <button type="button" className={`toggle-btn sell ${side === "sell" ? "active" : ""}`} onClick={() => setSide("sell")}>Sell</button>
        </div>

        <div className="form-group">
          <label className="form-label">Amount (USD)</label>
          <input
            className="form-input"
            type="number"
            min="1"
            step="0.01"
            placeholder="e.g. 200"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
          />
          {shares && <p className="muted" style={{ marginTop: "0.35rem" }}>≈ {shares} shares</p>}
        </div>

        <div className="form-group">
          <label className="form-label">Why are you making this trade?</label>
          <textarea
            className="form-input"
            placeholder="e.g. I think earnings will beat expectations…"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>

        {error && <p className="error">{error}</p>}

        <button className="btn-primary" type="submit" disabled={submitting || !quote}>
          {submitting ? "Placing…" : `${side === "buy" ? "Buy" : "Sell"} ${stock.symbol}`}
        </button>
      </form>
    </>
  );
}

// ── Step 3: Trade result ──────────────────────────────
function TradeResult({ trade, entryQuote, onReset }) {
  const [currentPrice, setCurrentPrice] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [fbLoading, setFbLoading] = useState(false);

  useEffect(() => {
    api.get(`/quotes/${trade.symbol}`).then(({ data }) => setCurrentPrice(data.price)).catch(() => {});
  }, [trade.symbol]);

  const returnPct = currentPrice
    ? trade.side === "buy"
      ? ((currentPrice - trade.price_at_trade) / trade.price_at_trade * 100).toFixed(2)
      : ((trade.price_at_trade - currentPrice) / trade.price_at_trade * 100).toFixed(2)
    : null;

  async function getAIFeedback() {
    setFbLoading(true);
    try {
      const { data } = await api.post(`/trades/${trade.id}/feedback`);
      setFeedback(data.ai_text);
    } catch {
      setFeedback("Feedback unavailable — check that Ollama is running.");
    } finally {
      setFbLoading(false);
    }
  }

  return (
    <>
      <div className="result-header">
        <div className="result-check">✓</div>
        <div className="result-symbol">{trade.symbol}</div>
        <div className="result-sub">{trade.side === "buy" ? "Bought" : "Sold"} · paper trade</div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="result-row">
          <span className="label">Entry price</span>
          <span className="value">${trade.price_at_trade.toFixed(2)}</span>
        </div>
        <div className="result-row">
          <span className="label">Current price</span>
          <span className="value">{currentPrice ? `$${currentPrice.toFixed(2)}` : "…"}</span>
        </div>
        <div className="result-row">
          <span className="label">Amount invested</span>
          <span className="value">${trade.total_value.toFixed(2)}</span>
        </div>
        {returnPct !== null && (
          <div className="result-row">
            <span className="label">Unrealised return</span>
            <span className={`value ${parseFloat(returnPct) >= 0 ? "pos" : "neg"}`}>
              {parseFloat(returnPct) >= 0 ? "+" : ""}{returnPct}%
            </span>
          </div>
        )}
      </div>

      {!feedback && (
        <div className="pattern-card">
          <div className="pattern-header"><div className="green-dot" /> AI coach feedback</div>
          <button className="btn-secondary" onClick={getAIFeedback} disabled={fbLoading}>
            {fbLoading ? "Generating feedback…" : "Get AI coaching"}
          </button>
        </div>
      )}

      {feedback && (
        <div className="pattern-card">
          <div className="pattern-header"><div className="green-dot" /> AI coach feedback</div>
          <p className="pattern-text">{feedback}</p>
        </div>
      )}

      <button className="btn-primary" style={{ marginTop: "0.5rem" }} onClick={onReset}>
        Place another trade
      </button>
    </>
  );
}

// ── TradeScreen (orchestrator) ────────────────────────
export default function TradeScreen() {
  const [step, setStep] = useState("pick"); // pick | form | result
  const [stock, setStock] = useState(null);
  const [trade, setTrade] = useState(null);
  const [entryQuote, setEntryQuote] = useState(null);

  if (step === "pick") {
    return (
      <div className="screen">
        <StockPicker onSelect={s => { setStock(s); setStep("form"); }} />
      </div>
    );
  }

  if (step === "form") {
    return (
      <div className="screen">
        <MakeTradeForm
          stock={stock}
          onBack={() => setStep("pick")}
          onDone={(t, q) => { setTrade(t); setEntryQuote(q); setStep("result"); }}
        />
      </div>
    );
  }

  return (
    <div className="screen">
      <TradeResult
        trade={trade}
        entryQuote={entryQuote}
        onReset={() => { setStep("pick"); setStock(null); setTrade(null); }}
      />
    </div>
  );
}
