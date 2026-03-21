import { useEffect, useRef, useState } from "react";
import api from "../api";

// ── Helpers ───────────────────────────────────────────

function calcStreak(trades) {
  if (!trades.length) return 0;
  const days = new Set(trades.map(t => t.created_at?.slice(0, 10)).filter(Boolean));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (days.has(d.toISOString().slice(0, 10))) streak++;
    else if (i > 0) break;
  }
  return streak;
}

function thisWeek(trades) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  return trades.filter(t => t.created_at && new Date(t.created_at) > cutoff).length;
}

function topStock(trades) {
  if (!trades.length) return "—";
  const counts = {};
  trades.forEach(t => { counts[t.symbol] = (counts[t.symbol] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ── Canvas card drawing ───────────────────────────────

function drawShareCard(canvas, { name, winRate, returnPct, bestTrade, totalTrades }) {
  const W = 800, H = 420;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, W, H);

  // Top accent bar
  ctx.fillStyle = "#1d9e75";
  ctx.fillRect(0, 0, W, 5);

  // Logo
  ctx.fillStyle = "#1d9e75";
  ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("UpAlpha", 56, 72);

  // Trader name
  ctx.fillStyle = "#f0f0f0";
  ctx.font = "bold 40px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText(name, 56, 136);

  // Subtitle
  ctx.fillStyle = "#555";
  ctx.font = "18px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText(`Paper trading stats · ${totalTrades} trade${totalTrades !== 1 ? "s" : ""}`, 56, 168);

  // Stat boxes
  const stats = [
    { label: "Win Rate",    value: `${winRate}%`,            color: "#1d9e75" },
    { label: "Return",      value: `${returnPct >= 0 ? "+" : ""}${returnPct}%`, color: returnPct >= 0 ? "#1d9e75" : "#e05252" },
    { label: "Best Trade",  value: bestTrade,                color: "#1d9e75" },
  ];

  const boxW = 200, boxH = 110, gap = 28;
  const startX = 56;
  const boxY = 210;

  stats.forEach((s, i) => {
    const x = startX + i * (boxW + gap);

    // Box background
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.roundRect(x, boxY, boxW, boxH, 14);
    ctx.fill();

    // Label
    ctx.fillStyle = "#555";
    ctx.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(s.label.toUpperCase(), x + boxW / 2, boxY + 30);

    // Value
    ctx.fillStyle = s.color;
    const fontSize = s.value.length > 7 ? 26 : 32;
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillText(s.value, x + boxW / 2, boxY + 75);

    ctx.textAlign = "left";
  });

  // Footer divider
  ctx.strokeStyle = "#1f1f1f";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(56, 356);
  ctx.lineTo(W - 56, 356);
  ctx.stroke();

  // Footer text
  ctx.fillStyle = "#333";
  ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("up-alpha.netlify.app", 56, 384);

  ctx.textAlign = "right";
  ctx.fillText(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }), W - 56, 384);
  ctx.textAlign = "left";
}

// ── Share modal ───────────────────────────────────────

function ShareModal({ stats, name, onClose }) {
  const canvasRef = useRef(null);
  const [shareUrl, setShareUrl]   = useState(null);
  const [copying, setCopying]     = useState(false);
  const [copied, setCopied]       = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      drawShareCard(canvasRef.current, { name, ...stats });
    }
  }, []);

  function handleDownload() {
    const canvas = canvasRef.current;
    const link = document.createElement("a");
    link.download = `upalpha-${name}-stats.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function handleCopyLink() {
    setLinkLoading(true);
    try {
      const { data } = await api.post("/share");
      setShareUrl(data.url);
      await navigator.clipboard.writeText(data.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback: show URL in prompt
      if (shareUrl) {
        await navigator.clipboard.writeText(shareUrl).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } finally {
      setLinkLoading(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "#000a",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div
        style={{
          background: "#161616",
          border: "0.5px solid #2a2a2a",
          borderRadius: "24px 24px 0 0",
          padding: "1.5rem 1.25rem 2.5rem",
          width: "100%",
          maxWidth: "420px",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: "#333", borderRadius: 2, margin: "0 auto 1.25rem" }} />

        <p style={{ fontWeight: 600, fontSize: "1rem", marginBottom: "1rem" }}>Share your stats</p>

        {/* Card preview — scale canvas to fit */}
        <div style={{
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: "1.1rem",
          border: "0.5px solid #222",
          lineHeight: 0,
        }}>
          <canvas
            ref={canvasRef}
            style={{ width: "100%", display: "block" }}
          />
        </div>

        {/* Stat chips under preview */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          {[
            { label: "Win Rate", value: `${stats.winRate}%` },
            { label: "Return",   value: `${stats.returnPct >= 0 ? "+" : ""}${stats.returnPct}%` },
            { label: "Best",     value: stats.bestTrade },
          ].map(c => (
            <span key={c.label} style={{
              background: "#1a1a1a",
              border: "0.5px solid #2a2a2a",
              borderRadius: "999px",
              padding: "0.25rem 0.75rem",
              fontSize: "0.78rem",
              color: "var(--muted)",
            }}>
              {c.label}: <strong style={{ color: "var(--text)" }}>{c.value}</strong>
            </span>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button
            onClick={handleDownload}
            style={{
              flex: 1,
              padding: "0.75rem",
              borderRadius: "12px",
              border: "1px solid #2a2a2a",
              background: "#1a1a1a",
              color: "var(--text)",
              fontSize: "0.88rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
            }}
          >
            ↓ Download PNG
          </button>

          <button
            onClick={handleCopyLink}
            disabled={linkLoading}
            style={{
              flex: 1,
              padding: "0.75rem",
              borderRadius: "12px",
              border: "none",
              background: copied ? "#1d9e75cc" : "var(--accent)",
              color: "#fff",
              fontSize: "0.88rem",
              fontWeight: 600,
              cursor: linkLoading ? "not-allowed" : "pointer",
              opacity: linkLoading ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
            }}
          >
            {linkLoading ? "Generating…" : copied ? "✓ Copied!" : "⎘ Copy Link"}
          </button>
        </div>

        {shareUrl && (
          <p style={{
            marginTop: "0.75rem",
            fontSize: "0.72rem",
            color: "var(--muted)",
            wordBreak: "break-all",
            textAlign: "center",
          }}>
            {shareUrl}
          </p>
        )}
      </div>
    </div>
  );
}

// ── ProgressScreen ────────────────────────────────────

export default function ProgressScreen() {
  const [trades, setTrades]       = useState([]);
  const [dash, setDash]           = useState(null);
  const [email, setEmail]         = useState("");
  const [pattern, setPattern]     = useState(null);
  const [patternLoading, setPatternLoading] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/trades/"),
      api.get("/dashboard"),
      api.get("/auth/me"),
    ])
      .then(([{ data: t }, { data: d }, { data: me }]) => {
        setTrades(t);
        setDash(d);
        setEmail(me.email);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function loadPattern() {
    setPatternLoading(true);
    try {
      const { data } = await api.get("/patterns/");
      setPattern(data.text);
    } catch {
      setPattern("Pattern analysis unavailable — check Ollama is running.");
    } finally {
      setPatternLoading(false);
    }
  }

  const totalInvested = trades.reduce((s, t) => s + t.total_value, 0);
  const streak = calcStreak(trades);
  const week   = thisWeek(trades);
  const best   = topStock(trades);

  const shareStats = dash ? {
    winRate:   dash.win_rate ?? 0,
    returnPct: dash.total_pnl_pct ?? 0,
    bestTrade: dash.best_trade ?? "—",
    totalTrades: trades.length,
  } : null;

  if (loading) return <div className="screen loading">Loading…</div>;

  return (
    <div className="screen">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <p className="screen-title" style={{ marginBottom: 0 }}>Progress</p>

        {shareStats && (
          <button
            onClick={() => setShowShare(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.4rem 0.9rem",
              borderRadius: "999px",
              border: "1px solid #1d9e7560",
              background: "#1d9e7515",
              color: "var(--accent)",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ↑ Share
          </button>
        )}
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total trades</div>
          <div className="stat-value">{trades.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">This week</div>
          <div className="stat-value">{week}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Win rate</div>
          <div className="stat-value" style={{ color: "var(--accent)", fontSize: "1.25rem" }}>
            {dash ? `${dash.win_rate.toFixed(0)}%` : "—"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Return</div>
          <div className="stat-value" style={{
            fontSize: "1.15rem",
            color: (dash?.total_pnl_pct ?? 0) >= 0 ? "var(--accent)" : "var(--red)",
          }}>
            {dash ? `${dash.total_pnl_pct >= 0 ? "+" : ""}${dash.total_pnl_pct.toFixed(2)}%` : "—"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Best trade</div>
          <div className="stat-value" style={{ fontSize: "1rem", color: "var(--accent)" }}>
            {dash?.best_trade ?? "—"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Top stock</div>
          <div className="stat-value" style={{ fontSize: "1.25rem" }}>{best}</div>
        </div>
      </div>

      <div className="pattern-card">
        <div className="pattern-header">
          <div className="green-dot" />
          Pattern spotted
        </div>
        {!pattern && (
          <button className="btn-secondary" onClick={loadPattern} disabled={patternLoading}>
            {patternLoading ? "Analysing your trades…" : "Analyse my trading patterns"}
          </button>
        )}
        {pattern && <p className="pattern-text">{pattern}</p>}
      </div>

      {showShare && shareStats && (
        <ShareModal
          stats={shareStats}
          name={email.split("@")[0]}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
