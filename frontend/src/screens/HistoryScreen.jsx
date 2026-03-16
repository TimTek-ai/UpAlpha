import { useEffect, useState } from "react";
import api from "../api";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function HistoryScreen() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/trades/")
      .then(({ data }) => setTrades(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="screen loading">Loading…</div>;

  return (
    <div className="screen">
      <p className="screen-title">History</p>

      {trades.length === 0 && (
        <p className="muted center" style={{ paddingTop: "2rem" }}>No trades yet.</p>
      )}

      {trades.map(trade => (
        <div key={trade.id} className="history-item">
          <span className={`side-badge ${trade.side}`}>{trade.side}</span>
          <div>
            <div className="history-sym">{trade.symbol}</div>
            <div className="history-meta">
              {trade.quantity.toFixed(4)} shares
              {trade.reason ? ` · "${trade.reason.slice(0, 30)}${trade.reason.length > 30 ? "…" : ""}"` : ""}
            </div>
          </div>
          <div className="history-right">
            <div className="history-amount">${trade.total_value.toFixed(2)}</div>
            <div className="history-date">{formatDate(trade.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
