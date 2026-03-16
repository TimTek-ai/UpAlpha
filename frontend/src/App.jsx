import { useState, useEffect } from "react";
import AuthPage from "./AuthPage";
import BottomNav from "./components/BottomNav";
import TradeScreen from "./screens/TradeScreen";
import ProgressScreen from "./screens/ProgressScreen";
import HistoryScreen from "./screens/HistoryScreen";
import ProfileScreen from "./screens/ProfileScreen";
import api from "./api";
import "./App.css";

function calcStreak(trades) {
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

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [tab, setTab] = useState("trade");
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!token) return;
    api.get("/trades/")
      .then(({ data }) => setStreak(calcStreak(data)))
      .catch(() => {});
  }, [token]);

  if (!token) {
    return <AuthPage onLogin={() => setToken(localStorage.getItem("token"))} />;
  }

  function handleLogout() {
    localStorage.removeItem("token");
    setToken(null);
  }

  return (
    <div className="app">
      <div className="topbar">
        <span className="logo">UpAlpha</span>
        {streak > 0 && (
          <span className="streak-pill">🔥 {streak}-day streak</span>
        )}
      </div>

      {tab === "trade"    && <TradeScreen />}
      {tab === "progress" && <ProgressScreen />}
      {tab === "history"  && <HistoryScreen />}
      {tab === "profile"  && <ProfileScreen onLogout={handleLogout} />}

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
