import { useEffect, useState } from "react";
import api from "../api";

export default function PortfolioScreen() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/portfolio/positions")
      .then(({ data }) => setPositions(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalValue = positions.reduce((s, p) => s + p.market_value, 0);
  const totalPL = positions.reduce((s, p) => s + p.unrealized_pl, 0);

  if (loading) return <div className="screen loading">Loading…</div>;

  return (
    <div className="screen">
      <p className="screen-title">Portfolio</p>

      {positions.length === 0 ? (
        <div style={{ paddingTop: "2rem", textAlign: "center" }}>
          <p style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📭</p>
          <p className="muted">No open positions yet.</p>
          <p className="muted" style={{ marginTop: "0.25rem" }}>Place a trade to see it here.</p>
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="stat-grid" style={{ marginBottom: "1rem" }}>
            <div className="stat-card">
              <div className="stat-label">Market value</div>
              <div className="stat-value" style={{ fontSize: "1.15rem" }}>${totalValue.toFixed(0)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Unrealised P&L</div>
              <div className={`stat-value ${totalPL >= 0 ? "pos" : "neg"}`} style={{ fontSize: "1.15rem" }}>
                {totalPL >= 0 ? "+" : ""}${totalPL.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Position cards */}
          {positions.map(p => (
            <div key={p.symbol} className="card" style={{ marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: "1rem" }}>{p.symbol}</span>
                  <span className="muted" style={{ marginLeft: "0.5rem", fontSize: "0.8rem" }}>{p.qty} shares</span>
                </div>
                <span className={`stat-value ${p.unrealized_plpc >= 0 ? "pos" : "neg"}`} style={{ fontSize: "0.95rem" }}>
                  {p.unrealized_plpc >= 0 ? "+" : ""}{p.unrealized_plpc.toFixed(2)}%
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                {[
                  { label: "Avg entry", value: `$${p.avg_entry_price.toFixed(2)}` },
                  { label: "Current", value: `$${p.current_price.toFixed(2)}` },
                  { label: "P&L", value: `${p.unrealized_pl >= 0 ? "+" : ""}$${p.unrealized_pl.toFixed(2)}` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: "var(--bg)", borderRadius: "8px", padding: "0.5rem 0.6rem" }}>
                    <div className="stat-label">{label}</div>
                    <div style={{ fontSize: "0.88rem", fontWeight: 500, marginTop: "0.2rem" }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
