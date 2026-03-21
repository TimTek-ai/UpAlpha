import { useEffect, useState, useRef } from "react";
import api from "../api";

const REFRESH_MS = 30_000;

const MEDALS = ["🥇", "🥈", "🥉"];

function fmt(n) {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function LeaderboardScreen() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const timerRef = useRef(null);

  async function fetchData(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      const { data: res } = await api.get("/leaderboard");
      setData(res);
      setLastRefresh(new Date());
    } catch {
      // keep stale data on error
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData(true);
    timerRef.current = setInterval(() => fetchData(false), REFRESH_MS);
    return () => clearInterval(timerRef.current);
  }, []);

  const entries = data?.entries ?? [];
  const myRank  = data?.current_user_rank;
  const total   = data?.total_traders ?? 0;

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.25rem" }}>
        <p className="screen-title" style={{ marginBottom: 0 }}>Leaderboard</p>
        <button
          onClick={() => fetchData(false)}
          style={{ background: "none", border: "none", color: "var(--accent)", fontSize: "0.78rem", cursor: "pointer", padding: 0 }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Subtitle */}
      <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "1.1rem" }}>
        Top traders by portfolio return · {total} participant{total !== 1 ? "s" : ""}
        {lastRefresh && (
          <span> · updated {lastRefresh.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
        )}
      </p>

      {/* Current user rank pill (if outside top 10) */}
      {myRank && myRank > 10 && (
        <div style={{
          background: "#1d9e7515",
          border: "1px solid #1d9e7540",
          borderRadius: "12px",
          padding: "0.6rem 1rem",
          marginBottom: "1rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "0.82rem",
        }}>
          <span style={{ color: "var(--muted)" }}>Your rank</span>
          <span style={{ fontWeight: 700, color: "var(--accent)" }}>#{myRank} of {total}</span>
        </div>
      )}

      {loading && <div style={{ color: "var(--muted)", textAlign: "center", paddingTop: "3rem" }}>Loading…</div>}

      {!loading && entries.length === 0 && (
        <p className="muted center" style={{ paddingTop: "2rem" }}>
          No traders yet — be the first on the board!
        </p>
      )}

      {entries.map((entry, i) => {
        const rank   = i + 1;
        const isMe   = entry.is_current_user;
        const pos    = entry.return_pct >= 0;
        const pnlClr = pos ? "var(--accent)" : "var(--red)";

        return (
          <div
            key={entry.user_id}
            style={{
              background: isMe ? "#1d9e7510" : "#1a1a1a",
              border: `0.5px solid ${isMe ? "#1d9e7545" : "#2a2a2a"}`,
              borderRadius: "14px",
              padding: "0.85rem 1rem",
              marginBottom: "0.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.85rem",
            }}
          >
            {/* Rank */}
            <div style={{ width: "2rem", textAlign: "center", flexShrink: 0 }}>
              {rank <= 3 ? (
                <span style={{ fontSize: "1.3rem" }}>{MEDALS[rank - 1]}</span>
              ) : (
                <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--muted)" }}>
                  #{rank}
                </span>
              )}
            </div>

            {/* Name */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {entry.name}
                </span>
                {isMe && (
                  <span style={{
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    color: "var(--accent)",
                    background: "#1d9e7520",
                    padding: "0.1rem 0.4rem",
                    borderRadius: "999px",
                    flexShrink: 0,
                  }}>
                    YOU
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                £{fmt(entry.portfolio_value)} portfolio
              </div>
            </div>

            {/* Return */}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: pnlClr, letterSpacing: "-0.3px" }}>
                {pos ? "+" : ""}{entry.return_pct.toFixed(2)}%
              </div>
              <div style={{ fontSize: "0.72rem", color: pnlClr, opacity: 0.8, marginTop: "0.1rem" }}>
                {pos ? "+" : ""}£{fmt(Math.abs(entry.pnl))}
              </div>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      {entries.length > 0 && (
        <p style={{ fontSize: "0.68rem", color: "var(--muted2)", textAlign: "center", marginTop: "0.75rem" }}>
          Return % based on realized P&L · starting balance £{fmt(entries[0]?.starting_balance ?? 100000)}
        </p>
      )}
    </div>
  );
}
