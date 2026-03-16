import { useEffect, useState } from "react";
import api from "../api";

function calcStreak(trades) {
  if (!trades.length) return 0;
  const days = new Set(trades.map(t => t.created_at?.slice(0, 10)).filter(Boolean));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) streak++;
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

export default function ProgressScreen() {
  const [trades, setTrades] = useState([]);
  const [pattern, setPattern] = useState(null);
  const [patternLoading, setPatternLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/trades/")
      .then(({ data }) => setTrades(data))
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
  const week = thisWeek(trades);
  const best = topStock(trades);

  if (loading) return <div className="screen loading">Loading…</div>;

  return (
    <div className="screen">
      <p className="screen-title">Progress</p>

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
          <div className="stat-label">Total invested</div>
          <div className="stat-value" style={{ fontSize: "1.15rem" }}>${totalInvested.toFixed(0)}</div>
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
    </div>
  );
}
