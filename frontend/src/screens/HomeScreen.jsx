import { useEffect, useState } from "react";
import api from "../api";

// ── Helpers ───────────────────────────────────────────
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function displayName(email = "") {
  const n = email.split("@")[0];
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function fmt(n) {
  return n >= 0 ? `+$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`;
}

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ── Weekly bar chart (pure SVG) ───────────────────────
function WeeklyChart({ data }) {
  const BAR_W = 30;
  const GAP   = 10;
  const H     = 56;
  const W     = data.length * (BAR_W + GAP) - GAP;
  const maxAbs = Math.max(...data.map(d => Math.abs(d.pnl)), 0.01);

  return (
    <svg
      width="100%"
      viewBox={`-4 0 ${W + 8} ${H + 22}`}
      style={{ overflow: "visible", display: "block", marginTop: "1rem" }}
    >
      {/* zero line */}
      <line x1={-4} y1={H} x2={W + 4} y2={H} stroke="#2a2a2a" strokeWidth={1} />

      {data.map((d, i) => {
        const barH  = Math.max((Math.abs(d.pnl) / maxAbs) * H, 3);
        const x     = i * (BAR_W + GAP);
        const isPos = d.pnl >= 0;
        const y     = isPos ? H - barH : H;
        const color = isPos ? "#1d9e75" : "#e24b4a";
        return (
          <g key={i}>
            <rect x={x} y={y} width={BAR_W} height={barH} rx={5} fill={color} opacity={0.9} />
            <text
              x={x + BAR_W / 2} y={H + 16}
              textAnchor="middle" fontSize={9} fill="#555"
            >
              {d.date}
            </text>
            {d.pnl !== 0 && (
              <text
                x={x + BAR_W / 2} y={isPos ? y - 4 : y + barH + 12}
                textAnchor="middle" fontSize={8}
                fill={color} opacity={0.85}
              >
                {isPos ? "+" : ""}{d.pnl.toFixed(0)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── HomeScreen ────────────────────────────────────────
export default function HomeScreen() {
  const [data, setData]       = useState(null);
  const [email, setEmail]     = useState("");
  const [insight, setInsight] = useState(null);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch dashboard + user in parallel; loading gate on these two
    Promise.allSettled([
      api.get("/dashboard"),
      api.get("/auth/me"),
    ]).then(([dashRes, meRes]) => {
      if (dashRes.status === "fulfilled") setData(dashRes.value.data);
      if (meRes.status  === "fulfilled") setEmail(meRes.value.data.email);
    }).finally(() => setLoading(false));

    // Balance is independent — don't let it block the rest of the screen
    api.get("/balance")
      .then(({ data }) => setBalance(data))
      .catch(() => {});
  }, []);

  // Fetch AI insight separately so dashboard loads fast
  useEffect(() => {
    api.get("/dashboard/insight")
      .then(({ data }) => setInsight(data.tip))
      .catch(() => setInsight(null));
  }, []);

  if (loading) return <div className="screen loading">Loading…</div>;

  const pnlPos   = (data?.total_pnl ?? 0) >= 0;
  const pnlColor = pnlPos ? "var(--accent)" : "var(--red)";

  return (
    <div className="screen">

      {/* Greeting */}
      <div style={{ marginBottom: "1.25rem" }}>
        <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "0.2rem" }}>
          {greeting()}
        </p>
        <h1 style={{ fontSize: "1.45rem", fontWeight: 600, letterSpacing: "-0.5px" }}>
          {displayName(email)} 👋
        </h1>
      </div>

      {/* Virtual balance card */}
      {balance && (
        <div style={{
          background: "linear-gradient(135deg, #1a2e1a 0%, #1a1a2e 100%)",
          border: "0.5px solid #2a3a2a",
          borderRadius: "16px",
          padding: "1rem 1.25rem",
          marginBottom: "0.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "0.2rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Virtual Balance
            </p>
            <p style={{ fontSize: "1.55rem", fontWeight: 700, letterSpacing: "-0.5px", color: "#fff" }}>
              £{balance.cash.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "0.2rem" }}>All-time P&L</p>
            <p style={{
              fontSize: "0.95rem",
              fontWeight: 600,
              color: balance.pnl >= 0 ? "var(--accent)" : "var(--red)",
            }}>
              {balance.pnl >= 0 ? "+" : ""}£{Math.abs(balance.pnl).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span style={{ fontSize: "0.75rem", marginLeft: "0.3rem", opacity: 0.8 }}>
                ({balance.pnl_pct >= 0 ? "+" : ""}{balance.pnl_pct.toFixed(2)}%)
              </span>
            </p>
          </div>
        </div>
      )}

      {/* P&L card */}
      <div className="card" style={{ marginBottom: "0.75rem", background: "#1a1a1a", border: "0.5px solid #2a2a2a" }}>
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.35rem" }}>
          Total Paper P&L
        </p>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem" }}>
          <span style={{ fontSize: "2rem", fontWeight: 700, color: pnlColor, letterSpacing: "-1px" }}>
            {fmt(data?.total_pnl ?? 0)}
          </span>
          <span style={{
            fontSize: "0.82rem", fontWeight: 500,
            color: pnlColor,
            background: pnlPos ? "#1d9e7515" : "#e24b4a15",
            padding: "0.15rem 0.5rem",
            borderRadius: "999px",
          }}>
            {(data?.total_pnl_pct ?? 0) >= 0 ? "+" : ""}{(data?.total_pnl_pct ?? 0).toFixed(2)}%
          </span>
        </div>
        {data?.weekly_returns && <WeeklyChart data={data.weekly_returns} />}
      </div>

      {/* 3 stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <div style={miniCard}>
          <p style={miniLabel}>Win Rate</p>
          <p style={{ ...miniValue, color: "var(--accent)" }}>
            {(data?.win_rate ?? 0).toFixed(0)}%
          </p>
        </div>
        <div style={miniCard}>
          <p style={miniLabel}>Trades</p>
          <p style={miniValue}>{data?.total_trades ?? 0}</p>
        </div>
        <div style={miniCard}>
          <p style={miniLabel}>Best</p>
          <p style={{ ...miniValue, color: "var(--accent)", fontSize: "0.95rem" }}>
            {data?.best_trade ?? "—"}
          </p>
        </div>
      </div>

      {/* AI insight */}
      <div className="pattern-card" style={{ marginBottom: "1.25rem", background: "#1a1a1a", border: "0.5px solid #2a2a2a" }}>
        <div className="pattern-header">
          <div className="green-dot" style={{ animation: "pulse 2s infinite" }} />
          AI Coach Insight
        </div>
        {insight === null ? (
          <p className="pattern-text" style={{ color: "var(--muted)" }}>
            Thinking…
          </p>
        ) : (
          <p className="pattern-text">{insight}</p>
        )}
      </div>

      {/* Recent trades */}
      <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Recent Trades
      </p>

      {(!data?.recent_trades?.length) && (
        <p className="muted center" style={{ paddingTop: "1rem" }}>No trades yet — make your first one!</p>
      )}

      {data?.recent_trades?.map(t => {
        const hasReturn = t.return_pct !== null && t.return_pct !== undefined;
        const retPos    = hasReturn && t.return_pct >= 0;
        const retColor  = retPos ? "var(--accent)" : "var(--red)";

        return (
          <div key={t.id} style={tradeRow}>
            {/* Direction badge */}
            <span className={`side-badge ${t.side}`} style={{ flexShrink: 0 }}>{t.side}</span>

            {/* Ticker + date */}
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, fontSize: "0.95rem" }}>{t.symbol}</p>
              <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.1rem" }}>
                {fmtDate(t.created_at)}
              </p>
            </div>

            {/* Return */}
            <div style={{ textAlign: "right" }}>
              {hasReturn ? (
                <p style={{ fontSize: "0.9rem", fontWeight: 600, color: retColor }}>
                  {retPos ? "+" : ""}{t.return_pct.toFixed(2)}%
                </p>
              ) : (
                <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  ${t.total_value.toFixed(0)}
                </p>
              )}
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}

// ── Inline style objects ──────────────────────────────
const miniCard = {
  background: "#1a1a1a",
  border: "0.5px solid #2a2a2a",
  borderRadius: "12px",
  padding: "0.85rem 0.75rem",
  textAlign: "center",
};
const miniLabel = {
  fontSize: "0.7rem",
  color: "var(--muted)",
  marginBottom: "0.3rem",
};
const miniValue = {
  fontSize: "1.15rem",
  fontWeight: 700,
  color: "var(--text)",
};
const tradeRow = {
  background: "#1a1a1a",
  border: "0.5px solid #2a2a2a",
  borderRadius: "12px",
  padding: "0.85rem 1rem",
  marginBottom: "0.55rem",
  display: "flex",
  alignItems: "center",
  gap: "0.85rem",
};
