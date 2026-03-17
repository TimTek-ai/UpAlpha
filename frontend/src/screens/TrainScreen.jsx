import { useEffect, useState, useCallback } from "react";
import api from "../api";

// ── Candlestick SVG chart ─────────────────────────────────────────────────
const SLOT_W   = 32;
const CANDLE_W = 20;
const PAD_L    = 6;
const PAD_R    = 44;   // space for price labels
const CHART_H  = 185;
const VIEW_H   = CHART_H + 26;

function CandleChart({ candles, nextCandle, revealed }) {
  const slots   = 9;
  const VIEW_W  = PAD_L + slots * SLOT_W + PAD_R;

  // Price range across all visible + (if revealed) next candle
  const src = revealed && nextCandle ? [...candles, nextCandle] : candles;
  const allH = src.map(c => c.high);
  const allL = src.map(c => c.low);
  const rawHi = Math.max(...allH);
  const rawLo = Math.min(...allL);
  const pad   = (rawHi - rawLo) * 0.10 || rawLo * 0.05;
  const hi    = rawHi + pad;
  const lo    = rawLo - pad;

  function toY(price) {
    return CHART_H - ((price - lo) / (hi - lo)) * CHART_H;
  }

  // 4 horizontal grid lines
  const gridLevels = [0.85, 0.6, 0.35, 0.1].map(t => lo + t * (hi - lo));

  function renderCandle(c, i, highlight = false) {
    const x      = PAD_L + i * SLOT_W + (SLOT_W - CANDLE_W) / 2;
    const cx     = x + CANDLE_W / 2;
    const isUp   = c.close >= c.open;
    const color  = isUp ? "#1d9e75" : "#e24b4a";
    const bodyT  = toY(Math.max(c.open, c.close));
    const bodyB  = toY(Math.min(c.open, c.close));
    const bodyH  = Math.max(bodyB - bodyT, 1.5);

    return (
      <g key={i}>
        {/* Wick */}
        <line x1={cx} y1={toY(c.high)} x2={cx} y2={toY(c.low)}
              stroke={color} strokeWidth={1.5} />
        {/* Body */}
        <rect x={x} y={bodyT} width={CANDLE_W} height={bodyH} rx={2.5} fill={color} />
        {/* Reveal highlight */}
        {highlight && (
          <rect x={x - 2} y={bodyT - 2} width={CANDLE_W + 4} height={bodyH + 4}
                rx={4} fill="none" stroke="#fff" strokeWidth={1} opacity={0.25} />
        )}
      </g>
    );
  }

  const hiddenX  = PAD_L + 8 * SLOT_W + (SLOT_W - CANDLE_W) / 2;
  const hiddenCX = hiddenX + CANDLE_W / 2;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Grid lines + price labels */}
      {gridLevels.map((price, i) => {
        const y = toY(price);
        return (
          <g key={i}>
            <line x1={PAD_L} y1={y} x2={VIEW_W - PAD_R + 4} y2={y}
                  stroke="#202020" strokeWidth={1} />
            <text x={VIEW_W - PAD_R + 7} y={y + 3.5}
                  fontSize={8.5} fill="#404040" dominantBaseline="middle">
              ${price.toFixed(price < 10 ? 2 : 0)}
            </text>
          </g>
        );
      })}

      {/* Separator before hidden candle */}
      <line
        x1={PAD_L + 8 * SLOT_W - 4} y1={0}
        x2={PAD_L + 8 * SLOT_W - 4} y2={CHART_H}
        stroke="#2a2a2a" strokeWidth={1} strokeDasharray="4,3"
      />

      {/* 8 visible candles */}
      {candles.map((c, i) => renderCandle(c, i))}

      {/* 9th slot — hidden or revealed */}
      {revealed && nextCandle
        ? renderCandle(nextCandle, 8, true)
        : (
          <g>
            <rect x={hiddenX} y={CHART_H * 0.18} width={CANDLE_W}
                  height={CHART_H * 0.64} rx={5}
                  fill="#1a1a1a" stroke="#333" strokeWidth={1} strokeDasharray="3,2" />
            <text x={hiddenCX} y={CHART_H * 0.52}
                  textAnchor="middle" fontSize={13} fill="#444">
              ?
            </text>
          </g>
        )
      }

      {/* X labels */}
      <text x={PAD_L + 7 * SLOT_W + SLOT_W / 2} y={VIEW_H - 4}
            textAnchor="middle" fontSize={8} fill="#3a3a3a">D8</text>
      <text x={PAD_L + 8 * SLOT_W + SLOT_W / 2} y={VIEW_H - 4}
            textAnchor="middle" fontSize={8} fill={revealed ? "#555" : "#2e2e2e"}>
        {revealed ? "D9" : "?"}
      </text>
    </svg>
  );
}

// ── XP flash animation ────────────────────────────────────────────────────
function XPFlash({ xp }) {
  return (
    <span style={{
      position:  "absolute", top: "-12px", right: "0",
      color:     "#1d9e75", fontWeight: 700, fontSize: "0.95rem",
      animation: "floatUp 1.4s ease-out forwards",
    }}>
      +{xp} XP
    </span>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────
function StatsBar({ stats }) {
  if (!stats) return null;
  return (
    <div style={{
      display: "flex", gap: "0.5rem", marginBottom: "1rem",
    }}>
      {[
        { label: "XP",       value: stats.total_xp },
        { label: "Streak",   value: stats.streak > 0 ? `🔥${stats.streak}` : stats.streak },
        { label: "Accuracy", value: `${stats.accuracy}%` },
      ].map(({ label, value }) => (
        <div key={label} style={{
          flex: 1, background: "#1a1a1a", border: "0.5px solid #2a2a2a",
          borderRadius: "10px", padding: "0.55rem 0.5rem", textAlign: "center",
        }}>
          <p style={{ fontSize: "0.62rem", color: "var(--muted)", marginBottom: "0.2rem" }}>
            {label}
          </p>
          <p style={{ fontSize: "0.95rem", fontWeight: 700 }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────
export default function TrainScreen() {
  const [phase,      setPhase]      = useState("loading"); // loading|question|submitting|revealed
  const [challenge,  setChallenge]  = useState(null);
  const [result,     setResult]     = useState(null);
  const [stats,      setStats]      = useState(null);
  const [myAnswer,   setMyAnswer]   = useState(null);
  const [showXP,     setShowXP]     = useState(false);
  const [error,      setError]      = useState("");

  const loadChallenge = useCallback(async () => {
    setPhase("loading");
    setResult(null);
    setMyAnswer(null);
    setShowXP(false);
    setError("");
    try {
      const { data } = await api.get("/train/challenge");
      setChallenge(data);
      setPhase("question");
    } catch {
      setError("Couldn't load a challenge — check your connection.");
      setPhase("question");
    }
  }, []);

  // Load stats + first challenge on mount
  useEffect(() => {
    api.get("/train/stats")
      .then(({ data }) => setStats(data))
      .catch(() => {});
    loadChallenge();
  }, []);

  async function handleAnswer(ans) {
    if (phase !== "question" || !challenge) return;
    setMyAnswer(ans);
    setPhase("submitting");
    try {
      const { data } = await api.post("/train/answer", {
        challenge_token: challenge.challenge_token,
        answer: ans,
      });
      setResult(data);
      setStats(data.stats);
      setPhase("revealed");
      if (data.xp_earned > 0) {
        setShowXP(true);
        setTimeout(() => setShowXP(false), 1500);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong.");
      setPhase("question");
      setMyAnswer(null);
    }
  }

  // ── Loading ──
  if (phase === "loading") {
    return (
      <div className="screen">
        <StatsBar stats={stats} />
        <div className="loading" style={{ paddingTop: "4rem" }}>Loading chart…</div>
      </div>
    );
  }

  const correct = result?.correct;

  return (
    <div className="screen">
      <StatsBar stats={stats} />

      {error && <p className="error" style={{ marginBottom: "0.75rem" }}>{error}</p>}

      {challenge && (
        <>
          {/* Stock header */}
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: "0.6rem",
          }}>
            <p style={{ fontWeight: 700, fontSize: "1.05rem" }}>{challenge.symbol}</p>
            <span style={{
              fontSize: "0.72rem", color: "var(--muted)",
              background: "#1a1a1a", border: "0.5px solid #2a2a2a",
              borderRadius: "999px", padding: "0.2rem 0.6rem",
            }}>Daily · 8 candles</span>
          </div>

          {/* Chart */}
          <div style={{
            background: "#111", border: "0.5px solid #2a2a2a",
            borderRadius: "14px", padding: "1rem 0.75rem 0.5rem",
            marginBottom: "1rem",
          }}>
            <CandleChart
              candles={challenge.candles}
              nextCandle={result?.next_candle}
              revealed={phase === "revealed"}
            />
          </div>

          {/* Question or Result */}
          {phase !== "revealed" ? (
            <>
              <p style={{
                fontSize: "0.9rem", color: "var(--muted)",
                textAlign: "center", marginBottom: "1rem",
              }}>
                What does the <strong style={{ color: "var(--text)" }}>next candle</strong> look like?
              </p>

              <div style={{ display: "flex", gap: "0.65rem" }}>
                <button
                  onClick={() => handleAnswer("bullish")}
                  disabled={phase === "submitting"}
                  style={{
                    ...ansBtn,
                    background: myAnswer === "bullish" ? "#1d9e7530" : "#1a1a1a",
                    border: `1.5px solid ${myAnswer === "bullish" ? "#1d9e75" : "#2a2a2a"}`,
                    color: "#1d9e75",
                  }}
                >
                  ▲ Bullish
                </button>
                <button
                  onClick={() => handleAnswer("bearish")}
                  disabled={phase === "submitting"}
                  style={{
                    ...ansBtn,
                    background: myAnswer === "bearish" ? "#e24b4a30" : "#1a1a1a",
                    border: `1.5px solid ${myAnswer === "bearish" ? "#e24b4a" : "#2a2a2a"}`,
                    color: "#e24b4a",
                  }}
                >
                  ▼ Bearish
                </button>
              </div>

              {phase === "submitting" && (
                <p className="loading" style={{ paddingTop: "1rem", paddingBottom: 0 }}>
                  Checking…
                </p>
              )}
            </>
          ) : (
            <>
              {/* Result badge */}
              <div style={{ position: "relative", marginBottom: "0.85rem" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.6rem",
                  padding: "0.75rem 1rem",
                  background: correct ? "#1d9e7515" : "#e24b4a15",
                  border: `1px solid ${correct ? "#1d9e7540" : "#e24b4a40"}`,
                  borderRadius: "12px",
                }}>
                  <span style={{ fontSize: "1.4rem" }}>{correct ? "✓" : "✗"}</span>
                  <div>
                    <p style={{
                      fontWeight: 700,
                      color: correct ? "var(--accent)" : "var(--red)",
                    }}>
                      {correct ? "Correct!" : "Not quite"}
                    </p>
                    <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.1rem" }}>
                      The candle was{" "}
                      <strong style={{ color: result.actual === "bullish" ? "var(--accent)" : "var(--red)" }}>
                        {result.actual}
                      </strong>
                      {correct ? ` — +${result.xp_earned} XP earned` : ""}
                    </p>
                  </div>
                </div>
                {showXP && <XPFlash xp={result.xp_earned} />}
              </div>

              {/* AI explanation */}
              <div className="pattern-card" style={{
                background: "#1a1a1a", border: "0.5px solid #2a2a2a",
                marginBottom: "1rem",
              }}>
                <div className="pattern-header">
                  <div className="green-dot" />
                  Why it happened
                </div>
                <p className="pattern-text">{result.explanation}</p>
              </div>

              <button
                className="btn-primary"
                onClick={loadChallenge}
                style={{ marginTop: 0 }}
              >
                Next Challenge →
              </button>
            </>
          )}
        </>
      )}

      <style>{`
        @keyframes floatUp {
          0%   { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-28px); }
        }
      `}</style>
    </div>
  );
}

const ansBtn = {
  flex: 1,
  padding: "0.85rem",
  borderRadius: "12px",
  fontSize: "1rem",
  fontWeight: 700,
  cursor: "pointer",
  transition: "all 0.15s",
  letterSpacing: "0.02em",
};
