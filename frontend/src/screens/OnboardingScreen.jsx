import { useState } from "react";

const SLIDES = [
  {
    icon: "📈",
    title: "Welcome to UpAlpha",
    body: "Practice stock trading with real market prices — without risking a single penny of real money.",
  },
  {
    icon: "🎯",
    title: "Learn by doing",
    body: "Pick stocks, place paper trades, and track your portfolio. See exactly how your decisions play out.",
  },
  {
    icon: "🤖",
    title: "Your personal AI coach",
    body: "After every trade, get plain-English feedback explaining what happened, what to watch for, and how to improve.",
  },
];

export default function OnboardingScreen({ onDone }) {
  const [slide, setSlide] = useState(0);
  const isLast = slide === SLIDES.length - 1;
  const { icon, title, body } = SLIDES[slide];

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem 1.5rem",
      maxWidth: "420px",
      margin: "0 auto",
      background: "var(--bg)",
    }}>
      <div style={{ fontSize: "3.5rem", marginBottom: "1.5rem" }}>{icon}</div>

      <h1 style={{ fontSize: "1.3rem", fontWeight: 600, textAlign: "center", marginBottom: "0.75rem" }}>
        {title}
      </h1>
      <p style={{ fontSize: "0.9rem", color: "var(--muted)", textAlign: "center", lineHeight: 1.65, marginBottom: "3rem" }}>
        {body}
      </p>

      {/* Dots */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "2rem" }}>
        {SLIDES.map((_, i) => (
          <div key={i} style={{
            width: i === slide ? "20px" : "7px",
            height: "7px",
            borderRadius: "999px",
            background: i === slide ? "var(--accent)" : "var(--border)",
            transition: "all 0.2s",
          }} />
        ))}
      </div>

      <button
        className="btn-primary"
        style={{ maxWidth: "280px" }}
        onClick={() => {
          if (isLast) {
            localStorage.setItem("upalpha_onboarded", "1");
            onDone();
          } else {
            setSlide(s => s + 1);
          }
        }}
      >
        {isLast ? "Start trading" : "Next"}
      </button>

      {!isLast && (
        <button
          className="btn-ghost"
          style={{ marginTop: "1rem" }}
          onClick={() => { localStorage.setItem("upalpha_onboarded", "1"); onDone(); }}
        >
          Skip
        </button>
      )}
    </div>
  );
}
