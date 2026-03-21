import { useEffect, useState } from "react";
import api from "../api";

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function PnlBadge({ pnl }) {
  const pos = pnl >= 0;
  return (
    <span style={{
      fontSize: "0.82rem",
      fontWeight: 700,
      color: pos ? "var(--accent)" : "var(--red)",
      background: pos ? "#1d9e7518" : "#e24b4a18",
      padding: "0.15rem 0.55rem",
      borderRadius: "999px",
      whiteSpace: "nowrap",
    }}>
      {pos ? "+" : ""}£{Math.abs(pnl).toFixed(2)}
    </span>
  );
}

function TradeRow({ trade, onClosed }) {
  const isOpenBuy = trade.side === "buy" && trade.exit_price == null;
  const isClosed  = trade.side === "buy" && trade.exit_price != null;
  const [closing, setClosing] = useState(false);
  const [error, setError]     = useState("");

  async function handleClose() {
    setError("");
    setClosing(true);
    try {
      const { data } = await api.post(`/trades/${trade.id}/close`);
      onClosed(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to close trade.");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div style={{
      background: "#1a1a1a",
      border: `0.5px solid ${isClosed && trade.pnl != null && trade.pnl < 0 ? "#e24b4a30" : isClosed ? "#1d9e7530" : "#2a2a2a"}`,
      borderRadius: "14px",
      padding: "0.9rem 1rem",
      marginBottom: "0.55rem",
    }}>
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span className={`side-badge ${trade.side}`}>{trade.side}</span>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{trade.symbol}</div>
          <div style={{ fontSize: "0.73rem", color: "var(--muted)", marginTop: "0.1rem" }}>
            {trade.quantity.toFixed(4)} shares · {formatDate(trade.created_at)}
            {trade.reason ? ` · "${trade.reason.slice(0, 28)}${trade.reason.length > 28 ? "…" : ""}"` : ""}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>
            £{trade.total_value.toFixed(2)}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.1rem" }}>
            @ £{trade.price_at_trade.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Closed trade: exit info + P&L */}
      {isClosed && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "0.65rem",
          paddingTop: "0.65rem",
          borderTop: "0.5px solid #2a2a2a",
        }}>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            Closed {formatDate(trade.closed_at)} · exit £{trade.exit_price.toFixed(2)}
          </div>
          <PnlBadge pnl={trade.pnl} />
        </div>
      )}

      {/* Open buy: Close button */}
      {isOpenBuy && (
        <div style={{ marginTop: "0.65rem" }}>
          {error && (
            <p style={{ fontSize: "0.75rem", color: "var(--red)", marginBottom: "0.4rem" }}>{error}</p>
          )}
          <button
            onClick={handleClose}
            disabled={closing}
            style={{
              width: "100%",
              padding: "0.5rem",
              borderRadius: "10px",
              border: "1px solid #e24b4a60",
              background: "#e24b4a12",
              color: "var(--red)",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: closing ? "not-allowed" : "pointer",
              opacity: closing ? 0.6 : 1,
            }}
          >
            {closing ? "Closing…" : "Close Trade"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function HistoryScreen() {
  const [trades, setTrades]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/trades/")
      .then(({ data }) => setTrades(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleClosed(updated) {
    setTrades(prev => prev.map(t => t.id === updated.id ? updated : t));
  }

  if (loading) return <div className="screen loading">Loading…</div>;

  const open   = trades.filter(t => t.side === "buy" && t.exit_price == null);
  const closed = trades.filter(t => t.side !== "buy" || t.exit_price != null);

  return (
    <div className="screen">
      <p className="screen-title">History</p>

      {trades.length === 0 && (
        <p className="muted center" style={{ paddingTop: "2rem" }}>No trades yet.</p>
      )}

      {open.length > 0 && (
        <>
          <p style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
            Open positions
          </p>
          {open.map(t => (
            <TradeRow key={t.id} trade={t} onClosed={handleClosed} />
          ))}
        </>
      )}

      {closed.length > 0 && (
        <>
          <p style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0.85rem 0 0.5rem" }}>
            Closed trades
          </p>
          {closed.map(t => (
            <TradeRow key={t.id} trade={t} onClosed={handleClosed} />
          ))}
        </>
      )}
    </div>
  );
}
