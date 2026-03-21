import { useState, useEffect } from "react";
import api from "../api";

const ALL_STOCKS = [
  { symbol: "AAPL",  name: "Apple",       sector: "Tech"     },
  { symbol: "MSFT",  name: "Microsoft",   sector: "Tech"     },
  { symbol: "GOOGL", name: "Alphabet",    sector: "Tech"     },
  { symbol: "AMZN",  name: "Amazon",      sector: "Tech"     },
  { symbol: "NVDA",  name: "NVIDIA",      sector: "Tech"     },
  { symbol: "META",  name: "Meta",        sector: "Tech"     },
  { symbol: "TSLA",  name: "Tesla",       sector: "Tech"     },
  { symbol: "JPM",   name: "JPMorgan",    sector: "Finance"  },
  { symbol: "BAC",   name: "Bank of Am.", sector: "Finance"  },
  { symbol: "V",     name: "Visa",        sector: "Finance"  },
  { symbol: "MA",    name: "Mastercard",  sector: "Finance"  },
  { symbol: "GS",    name: "Goldman",     sector: "Finance"  },
  { symbol: "JNJ",   name: "J&J",         sector: "Health"   },
  { symbol: "PFE",   name: "Pfizer",      sector: "Health"   },
  { symbol: "UNH",   name: "UnitedHealth",sector: "Health"   },
  { symbol: "WMT",   name: "Walmart",     sector: "Consumer" },
  { symbol: "MCD",   name: "McDonald's",  sector: "Consumer" },
  { symbol: "SBUX",  name: "Starbucks",   sector: "Consumer" },
  { symbol: "XOM",   name: "ExxonMobil",  sector: "Energy"   },
  { symbol: "CVX",   name: "Chevron",     sector: "Energy"   },
];

const SECTORS = ["All", "Tech", "Finance", "Health", "Consumer", "Energy"];

// ── Step 1: Pick a stock ──────────────────────────────
function StockPicker({ onSelect }) {
  const [quotes, setQuotes] = useState({});
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("All");

  const visible = ALL_STOCKS.filter(s =>
    (sector === "All" || s.sector === sector) &&
    (search === "" || s.symbol.includes(search.toUpperCase()) || s.name.toUpperCase().includes(search.toUpperCase()))
  );

  // Only fetch quotes for visible stocks
  useEffect(() => {
    visible.forEach(({ symbol }) => {
      if (quotes[symbol]) return;
      api.get(`/quotes/${symbol}`)
        .then(({ data }) => setQuotes(q => ({ ...q, [symbol]: data })))
        .catch(() => {});
    });
  }, [sector, search]);

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
          placeholder="Search ticker or name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </form>

      {/* Sector filter */}
      <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", marginBottom: "1rem", paddingBottom: "2px" }}>
        {SECTORS.map(s => (
          <button
            key={s}
            onClick={() => setSector(s)}
            style={{
              flexShrink: 0,
              padding: "0.3rem 0.75rem",
              borderRadius: "999px",
              border: "1px solid",
              borderColor: sector === s ? "var(--accent)" : "var(--border)",
              background: sector === s ? "#1d9e7520" : "none",
              color: sector === s ? "var(--accent)" : "var(--muted)",
              fontSize: "0.78rem",
              cursor: "pointer",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="stock-grid">
        {visible.map(({ symbol, name }) => {
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
  const [balance, setBalance] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!quote) {
      api.get(`/quotes/${stock.symbol}`).then(({ data }) => setQuote(data)).catch(() => {});
    }
    api.get("/balance").then(({ data }) => setBalance(data)).catch(() => {});
  }, [stock.symbol]);

  const shares = quote && amount ? (parseFloat(amount) / quote.price).toFixed(4) : null;
  const parsedAmount = parseFloat(amount) || 0;
  const insufficientFunds = side === "buy" && balance !== null && parsedAmount > balance.cash;

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
      if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
        setError("Request timed out — market data is slow. Please try again.");
      } else {
        setError(err.response?.data?.detail || `Trade failed (${err.message || "network error"}). Try again.`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button className="back-btn" onClick={onBack}>← Back</button>

      {balance && (
        <div style={{
          background: "#1a1a1a",
          border: `0.5px solid ${insufficientFunds ? "var(--red)" : "#2a2a2a"}`,
          borderRadius: "12px",
          padding: "0.65rem 1rem",
          marginBottom: "0.75rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Available balance</span>
          <span style={{ fontSize: "0.95rem", fontWeight: 600, color: insufficientFunds ? "var(--red)" : "var(--accent)" }}>
            £{balance.cash.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      )}

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
          <label className="form-label">Amount (£)</label>
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
          {insufficientFunds && (
            <p style={{ color: "var(--red)", fontSize: "0.8rem", marginTop: "0.35rem" }}>
              Not enough balance. You have £{balance.cash.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} available.
            </p>
          )}
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

        <button className="btn-primary" type="submit" disabled={submitting || !quote || insufficientFunds}>
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
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    api.get(`/quotes/${trade.symbol}`).then(({ data }) => setCurrentPrice(data.price)).catch(() => {});
    api.get("/balance").then(({ data }) => setBalance(data)).catch(() => {});
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

      {balance && (
        <div style={{
          background: "#1a1a1a",
          border: "0.5px solid #2a3a2a",
          borderRadius: "12px",
          padding: "0.65rem 1rem",
          marginBottom: "0.75rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Remaining balance</span>
          <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--accent)" }}>
            £{balance.cash.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      )}

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
