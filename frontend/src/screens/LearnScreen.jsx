import { useState, useEffect, useCallback } from "react";
import api from "../api";

// ── Design tokens (inline so this screen is self-contained) ──────────────────
const C = {
  bg:      "#111",
  card:    "#1a1a1a",
  border:  "#2a2a2a",
  accent:  "#1d9e75",
  red:     "#e24b4a",
  muted:   "#666",
  text:    "#f0f0f0",
};

// ── Shared: mini candlestick SVG chart ────────────────────────────────────────
function CandleChart({ candles, highlightLast = 0 }) {
  const SLOT_W   = 34;
  const CANDLE_W = 20;
  const PAD_L    = 6;
  const PAD_R    = 42;
  const CHART_H  = 160;
  const VIEW_W   = PAD_L + candles.length * SLOT_W + PAD_R;
  const VIEW_H   = CHART_H + 20;

  const allH = candles.map(c => c.high);
  const allL = candles.map(c => c.low);
  const rawHi = Math.max(...allH);
  const rawLo = Math.min(...allL);
  const pad   = (rawHi - rawLo) * 0.12 || rawLo * 0.04;
  const hi    = rawHi + pad;
  const lo    = rawLo - pad;

  function toY(p) {
    return CHART_H - ((p - lo) / (hi - lo)) * CHART_H;
  }

  const gridLevels = [0.82, 0.55, 0.28].map(t => lo + t * (hi - lo));

  return (
    <svg width="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={{ display: "block", overflow: "visible" }}>
      {/* Grid */}
      {gridLevels.map((price, i) => (
        <g key={i}>
          <line x1={PAD_L} y1={toY(price)} x2={VIEW_W - PAD_R + 4} y2={toY(price)}
                stroke="#1e1e1e" strokeWidth={1} />
          <text x={VIEW_W - PAD_R + 7} y={toY(price) + 3.5} fontSize={8} fill="#383838">
            ${price.toFixed(price < 10 ? 2 : 0)}
          </text>
        </g>
      ))}

      {candles.map((c, i) => {
        const isHighlighted = i >= candles.length - highlightLast;
        const x    = PAD_L + i * SLOT_W + (SLOT_W - CANDLE_W) / 2;
        const cx   = x + CANDLE_W / 2;
        const isUp = c.close >= c.open;
        const color = isUp ? C.accent : C.red;
        const bodyT = toY(Math.max(c.open, c.close));
        const bodyB = toY(Math.min(c.open, c.close));
        const bodyH = Math.max(bodyB - bodyT, 1.5);

        return (
          <g key={i}>
            {/* Highlight backdrop */}
            {isHighlighted && (
              <rect x={x - 4} y={2} width={CANDLE_W + 8} height={CHART_H - 2}
                    rx={5} fill={color} opacity={0.06} />
            )}
            <line x1={cx} y1={toY(c.high)} x2={cx} y2={toY(c.low)}
                  stroke={color} strokeWidth={isHighlighted ? 1.8 : 1.2} />
            <rect x={x} y={bodyT} width={CANDLE_W} height={bodyH} rx={3}
                  fill={color} opacity={isHighlighted ? 1 : 0.75} />
          </g>
        );
      })}

      {/* "Pattern" label on highlighted zone */}
      {highlightLast > 0 && (
        <text
          x={PAD_L + (candles.length - highlightLast) * SLOT_W + (highlightLast * SLOT_W) / 2 + CANDLE_W / 2 - 4}
          y={VIEW_H - 3}
          textAnchor="middle" fontSize={8} fill={C.accent}
        >
          pattern
        </text>
      )}
    </svg>
  );
}

// ── Shared: choice button ─────────────────────────────────────────────────────
function ChoiceBtn({ label, prefix, selected, correct, revealed, onClick }) {
  let borderColor = C.border;
  let bg          = C.card;
  let textColor   = C.text;

  if (revealed) {
    if (correct)   { borderColor = C.accent; bg = "#1d9e7518"; textColor = C.accent; }
    else if (selected) { borderColor = C.red;   bg = "#e24b4a18"; textColor = C.red; }
    else           { textColor = C.muted; }
  } else if (selected) {
    borderColor = C.accent; bg = "#1d9e7518";
  }

  return (
    <button
      onClick={onClick}
      disabled={revealed}
      style={{
        width: "100%", textAlign: "left",
        padding: "0.75rem 1rem",
        background: bg,
        border: `1.5px solid ${borderColor}`,
        borderRadius: "10px",
        color: textColor,
        fontSize: "0.88rem",
        cursor: revealed ? "default" : "pointer",
        transition: "all 0.15s",
        display: "flex", alignItems: "center", gap: "0.6rem",
        marginBottom: "0.5rem",
      }}
    >
      <span style={{
        width: "22px", height: "22px", borderRadius: "50%", flexShrink: 0,
        background: revealed && correct ? C.accent : revealed && selected ? C.red : "#252525",
        border: `1px solid ${borderColor}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.7rem", fontWeight: 700, color: revealed && (correct || selected) ? "#fff" : C.muted,
      }}>
        {prefix}
      </span>
      {label}
    </button>
  );
}

// ── Shared: result badge ──────────────────────────────────────────────────────
function ResultBadge({ correct, xp, message }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.65rem",
      padding: "0.8rem 1rem",
      background: correct ? "#1d9e7514" : "#e24b4a14",
      border: `1px solid ${correct ? "#1d9e7535" : "#e24b4a35"}`,
      borderRadius: "12px", marginBottom: "0.85rem",
    }}>
      <span style={{ fontSize: "1.5rem" }}>{correct ? "✓" : "✗"}</span>
      <div>
        <p style={{ fontWeight: 700, color: correct ? C.accent : C.red, fontSize: "0.95rem" }}>
          {correct ? `Correct! +${xp} XP` : "Not quite"}
        </p>
        {message && <p style={{ fontSize: "0.78rem", color: C.muted, marginTop: "0.15rem" }}>{message}</p>}
      </div>
    </div>
  );
}

// ── Shared: AI explanation card ───────────────────────────────────────────────
function ExplainCard({ text }) {
  return (
    <div style={{
      background: C.card, border: `0.5px solid ${C.border}`,
      borderRadius: "12px", padding: "1rem", marginBottom: "1rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.6rem" }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.accent }} />
        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: C.accent }}>Why</span>
      </div>
      <p style={{ fontSize: "0.87rem", lineHeight: 1.65, color: "#ccc" }}>{text}</p>
    </div>
  );
}

// ── Screen 1: Learn Home ──────────────────────────────────────────────────────
function LearnHome({ onSelect, stats }) {
  const cTotal = stats?.learn_candlestick_total ?? 0;
  const sTotal = stats?.learn_strategy_total   ?? 0;
  const CANDLE_GOAL   = 10;
  const STRATEGY_GOAL = 9;

  const modules = [
    {
      id:       "candlestick",
      icon:     "📊",
      title:    "Candlestick Patterns",
      subtitle: "Identify patterns on real charts",
      progress: Math.min(cTotal / CANDLE_GOAL, 1),
      done:     cTotal,
      goal:     CANDLE_GOAL,
      locked:   false,
    },
    {
      id:       "strategies",
      icon:     "📈",
      title:    "Trading Strategies",
      subtitle: "RSI, Momentum, Moving Average",
      progress: Math.min(sTotal / STRATEGY_GOAL, 1),
      done:     sTotal,
      goal:     STRATEGY_GOAL,
      locked:   false,
    },
    {
      id:       null,
      icon:     "📖",
      title:    "Reading Charts",
      subtitle: "Support, resistance & trendlines",
      progress: 0,
      done:     0,
      goal:     10,
      locked:   false,
      soon:     true,
    },
    {
      id:       null,
      icon:     "🔒",
      title:    "Risk Management",
      subtitle: "Position sizing, stop-losses, Kelly",
      progress: 0,
      done:     0,
      goal:     10,
      locked:   true,
    },
  ];

  return (
    <div className="screen">
      <p className="screen-title">Learn</p>

      {modules.map((m, i) => (
        <div
          key={i}
          onClick={() => !m.locked && !m.soon && m.id && onSelect(m.id)}
          style={{
            background: C.card,
            border: `0.5px solid ${C.border}`,
            borderRadius: "14px",
            padding: "1rem 1.1rem",
            marginBottom: "0.75rem",
            cursor: m.locked || m.soon || !m.id ? "default" : "pointer",
            opacity: m.locked ? 0.5 : 1,
            transition: "border-color 0.15s",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.6rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ fontSize: "1.3rem" }}>{m.icon}</span>
              <div>
                <p style={{ fontWeight: 600, fontSize: "0.95rem" }}>{m.title}</p>
                <p style={{ fontSize: "0.75rem", color: C.muted, marginTop: "0.1rem" }}>{m.subtitle}</p>
              </div>
            </div>
            {m.locked && (
              <span style={{
                fontSize: "0.65rem", fontWeight: 700, color: "#e8a838",
                background: "#e8a83815", border: "1px solid #e8a83840",
                borderRadius: "999px", padding: "0.2rem 0.5rem",
              }}>PRO</span>
            )}
            {m.soon && (
              <span style={{
                fontSize: "0.65rem", color: C.muted,
                background: "#ffffff08", border: `1px solid ${C.border}`,
                borderRadius: "999px", padding: "0.2rem 0.5rem",
              }}>Soon</span>
            )}
            {!m.locked && !m.soon && m.id && (
              <span style={{ color: C.muted, fontSize: "0.9rem" }}>›</span>
            )}
          </div>

          {/* Progress bar */}
          <div style={{ background: "#252525", borderRadius: "999px", height: "5px", overflow: "hidden" }}>
            <div style={{
              width: `${m.progress * 100}%`,
              height: "100%",
              background: m.progress >= 1 ? C.accent : `linear-gradient(90deg, ${C.accent}99, ${C.accent})`,
              borderRadius: "999px",
              transition: "width 0.4s ease",
            }} />
          </div>
          <p style={{ fontSize: "0.7rem", color: C.muted, marginTop: "0.35rem" }}>
            {m.locked ? "Upgrade to unlock" : m.soon ? "Coming soon" : `${m.done} / ${m.goal} completed`}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Screen 2: Candlestick Lesson ──────────────────────────────────────────────
function CandlestickLesson({ onBack }) {
  const [phase,     setPhase]     = useState("loading");
  const [challenge, setChallenge] = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState("");

  const load = useCallback(async () => {
    setPhase("loading"); setResult(null); setSelected(null); setError("");
    try {
      const { data } = await api.get("/learn/candlestick/challenge");
      setChallenge(data);
      setPhase("question");
    } catch {
      setError("Couldn't load a challenge — try again.");
      setPhase("question");
    }
  }, []);

  useEffect(() => { load(); }, []);

  async function submit() {
    if (!selected || !challenge) return;
    setPhase("submitting");
    try {
      const { data } = await api.post("/learn/candlestick/answer", {
        challenge_token: challenge.challenge_token,
        answer: selected,
      });
      setResult(data);
      setPhase("revealed");
    } catch (e) {
      setError(e.response?.data?.detail || "Something went wrong.");
      setPhase("question");
    }
  }

  const LABELS = ["A", "B", "C", "D"];

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← Modules</button>
      <p className="screen-title">Candlestick Patterns</p>

      {error && <p className="error" style={{ marginBottom: "0.75rem" }}>{error}</p>}

      {phase === "loading" && <div className="loading">Loading real chart data…</div>}

      {challenge && phase !== "loading" && (
        <>
          {/* Symbol pill + chart */}
          <div style={{
            background: "#111", border: `0.5px solid ${C.border}`,
            borderRadius: "14px", padding: "1rem 0.75rem 0.5rem",
            marginBottom: "1rem",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ fontWeight: 700 }}>{challenge.symbol}</span>
              <span style={{ fontSize: "0.7rem", color: C.muted }}>Daily · 5 candles</span>
            </div>
            <CandleChart candles={challenge.candles} highlightLast={challenge.highlight_last} />
          </div>

          {/* Pattern info card after reveal */}
          {phase === "revealed" && result && (
            <>
              <ResultBadge
                correct={result.correct}
                xp={result.xp_earned}
                message={`This is a ${result.pattern} — ${result.signal}`}
              />

              {/* Pattern description */}
              <div style={{
                background: C.card, border: `0.5px solid ${C.border}`,
                borderRadius: "12px", padding: "0.85rem 1rem",
                marginBottom: "0.75rem",
              }}>
                <p style={{ fontSize: "0.75rem", color: C.accent, fontWeight: 600, marginBottom: "0.35rem" }}>
                  {result.pattern}
                </p>
                <p style={{ fontSize: "0.85rem", color: "#ccc", lineHeight: 1.6 }}>{result.description}</p>
              </div>

              <ExplainCard text={result.explanation} />
            </>
          )}

          {/* Choices */}
          <p style={{ fontSize: "0.8rem", color: C.muted, marginBottom: "0.65rem" }}>
            {phase === "revealed" ? "The pattern was:" : "What pattern do you see?"}
          </p>

          {challenge.choices.map((choice, i) => (
            <ChoiceBtn
              key={choice}
              label={choice}
              prefix={LABELS[i]}
              selected={selected === choice}
              correct={phase === "revealed" && choice === result?.pattern}
              revealed={phase === "revealed"}
              onClick={() => phase === "question" && setSelected(choice)}
            />
          ))}

          {phase === "question" && (
            <button
              className="btn-primary"
              onClick={submit}
              disabled={!selected}
              style={{ marginTop: "0.5rem" }}
            >
              Submit Answer
            </button>
          )}

          {phase === "revealed" && (
            <button className="btn-primary" onClick={load} style={{ marginTop: "0.25rem" }}>
              Next Pattern →
            </button>
          )}

          {phase === "submitting" && (
            <div className="loading" style={{ padding: "1rem 0" }}>Checking…</div>
          )}
        </>
      )}
    </div>
  );
}

// ── Screen 3: Strategies List ─────────────────────────────────────────────────
const STRATEGY_META = {
  rsi:      { color: C.accent,   diffColor: "#1d9e7520", diff: "Beginner" },
  momentum: { color: "#e8a838",  diffColor: "#e8a83820", diff: "Intermediate" },
  ma_cross: { color: "#7b6cf6",  diffColor: "#7b6cf620", diff: "Beginner" },
};

const STRATEGY_CARDS = [
  {
    id: "rsi",
    name: "RSI Mean Reversion",
    description: "Uses the Relative Strength Index to spot overbought (>70) and oversold (<30) conditions and trade the snap back.",
    risk: "Low–Medium", frequency: "Daily",
  },
  {
    id: "momentum",
    name: "Momentum Breakout",
    description: "Enters when price breaks above resistance or below support on high volume, riding the new trend.",
    risk: "Medium", frequency: "Weekly",
  },
  {
    id: "ma_cross",
    name: "Moving Average Cross",
    description: "Uses the golden cross (20 MA over 50 MA) and death cross to spot early trend changes.",
    risk: "Low", frequency: "Monthly",
  },
];

function StrategiesView({ onSelect, onBack }) {
  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← Modules</button>
      <p className="screen-title">Trading Strategies</p>

      {STRATEGY_CARDS.map(s => {
        const meta = STRATEGY_META[s.id];
        return (
          <div key={s.id} style={{
            background: C.card, border: `0.5px solid ${C.border}`,
            borderRadius: "14px", padding: "1.1rem",
            marginBottom: "0.75rem",
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
              <p style={{ fontWeight: 700, fontSize: "1rem", color: meta.color }}>{s.name}</p>
              <span style={{
                fontSize: "0.65rem", fontWeight: 700,
                color: meta.color, background: meta.diffColor,
                borderRadius: "999px", padding: "0.2rem 0.55rem",
                flexShrink: 0, marginLeft: "0.5rem",
              }}>
                {meta.diff}
              </span>
            </div>

            <p style={{ fontSize: "0.83rem", color: "#bbb", lineHeight: 1.55, marginBottom: "0.85rem" }}>
              {s.description}
            </p>

            {/* Tags */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.9rem" }}>
              {[`Risk: ${s.risk}`, `Freq: ${s.frequency}`].map(tag => (
                <span key={tag} style={{
                  fontSize: "0.7rem", color: C.muted,
                  background: "#1f1f1f", border: `1px solid ${C.border}`,
                  borderRadius: "999px", padding: "0.2rem 0.6rem",
                }}>{tag}</span>
              ))}
            </div>

            <button
              onClick={() => onSelect(s.id)}
              style={{
                width: "100%", padding: "0.65rem",
                background: meta.diffColor,
                border: `1px solid ${meta.color}40`,
                borderRadius: "10px",
                color: meta.color, fontWeight: 600, fontSize: "0.88rem",
                cursor: "pointer",
              }}
            >
              Practice Quiz →
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Screen 4: Strategy Quiz ───────────────────────────────────────────────────
function StrategyQuiz({ strategyId, onBack }) {
  const [phase,     setPhase]     = useState("loading");
  const [challenge, setChallenge] = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState("");

  const meta = STRATEGY_META[strategyId] || STRATEGY_META.rsi;
  const LABELS = ["A", "B", "C", "D"];

  const load = useCallback(async () => {
    setPhase("loading"); setResult(null); setSelected(null); setError("");
    try {
      const { data } = await api.get(`/learn/strategy/challenge/${strategyId}`);
      setChallenge(data);
      setPhase("question");
    } catch {
      setError("Couldn't load a scenario — try again.");
      setPhase("question");
    }
  }, [strategyId]);

  useEffect(() => { load(); }, []);

  async function submit() {
    if (selected === null || !challenge) return;
    setPhase("submitting");
    try {
      const { data } = await api.post("/learn/strategy/answer", {
        challenge_token: challenge.challenge_token,
        answer_idx: selected,
      });
      setResult(data);
      setPhase("revealed");
    } catch (e) {
      setError(e.response?.data?.detail || "Something went wrong.");
      setPhase("question");
      setSelected(null);
    }
  }

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← Strategies</button>

      {/* Strategy pill */}
      {challenge && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "0.4rem",
          background: meta.diffColor, border: `1px solid ${meta.color}40`,
          borderRadius: "999px", padding: "0.25rem 0.75rem",
          marginBottom: "1rem",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color }} />
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: meta.color }}>
            {challenge.strategy_name}
          </span>
        </div>
      )}

      {error && <p className="error" style={{ marginBottom: "0.75rem" }}>{error}</p>}
      {phase === "loading" && <div className="loading">Loading scenario…</div>}

      {challenge && phase !== "loading" && (
        <>
          {/* Scenario card */}
          <div style={{
            background: C.card, border: `0.5px solid ${C.border}`,
            borderRadius: "14px", padding: "1.1rem",
            marginBottom: "1rem",
          }}>
            <p style={{ fontSize: "0.7rem", color: C.muted, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Scenario
            </p>
            <p style={{ fontSize: "0.88rem", lineHeight: 1.65, color: C.text }}>
              {challenge.setup}
            </p>
          </div>

          {/* Result + explanation */}
          {phase === "revealed" && result && (
            <>
              <ResultBadge
                correct={result.correct}
                xp={result.xp_earned}
                message={result.correct ? null : `Correct answer: ${LABELS[result.correct_idx]}`}
              />
              <ExplainCard text={result.explanation} />
            </>
          )}

          {/* Question + choices */}
          <p style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.75rem" }}>
            {challenge.question}
          </p>

          {challenge.choices.map((choice, i) => (
            <ChoiceBtn
              key={i}
              label={choice}
              prefix={LABELS[i]}
              selected={selected === i}
              correct={phase === "revealed" && i === result?.correct_idx}
              revealed={phase === "revealed"}
              onClick={() => phase === "question" && setSelected(i)}
            />
          ))}

          {phase === "question" && (
            <button
              className="btn-primary"
              onClick={submit}
              disabled={selected === null}
              style={{ marginTop: "0.5rem" }}
            >
              Submit Answer
            </button>
          )}

          {phase === "revealed" && (
            <button className="btn-primary" onClick={load} style={{ marginTop: "0.25rem" }}>
              Next Scenario →
            </button>
          )}

          {phase === "submitting" && (
            <div className="loading" style={{ padding: "1rem 0" }}>Checking…</div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main: Learn Screen (navigation hub) ──────────────────────────────────────
export default function LearnScreen() {
  const [view,       setView]       = useState("home");
  const [strategyId, setStrategyId] = useState(null);
  const [stats,      setStats]      = useState(null);

  function refreshStats() {
    api.get("/learn/stats").then(({ data }) => setStats(data)).catch(() => {});
  }

  useEffect(() => { refreshStats(); }, []);

  if (view === "home") {
    return <LearnHome stats={stats} onSelect={id => {
      if (id === "strategies") setView("strategies");
      else setView(id);
    }} />;
  }

  if (view === "candlestick") {
    return <CandlestickLesson onBack={() => { setView("home"); refreshStats(); }} />;
  }

  if (view === "strategies") {
    return <StrategiesView
      onBack={() => setView("home")}
      onSelect={id => { setStrategyId(id); setView("strategy-quiz"); }}
    />;
  }

  if (view === "strategy-quiz") {
    return <StrategyQuiz
      strategyId={strategyId}
      onBack={() => { setView("strategies"); refreshStats(); }}
    />;
  }

  return null;
}
