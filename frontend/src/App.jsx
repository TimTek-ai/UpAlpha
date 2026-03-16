import { useState } from "react";
import AuthPage from "./AuthPage";
import TradeForm from "./TradeForm";
import TradeHistory from "./TradeHistory";
import "./App.css";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [refresh, setRefresh] = useState(0);

  function handleLogin() {
    setToken(localStorage.getItem("token"));
  }

  function handleLogout() {
    localStorage.removeItem("token");
    setToken(null);
  }

  function handleTradePlaced() {
    setRefresh(r => r + 1);
  }

  if (!token) return <AuthPage onLogin={handleLogin} />;

  return (
    <div className="app">
      <header className="header">
        <span className="logo">UpAlpha</span>
        <button className="btn-ghost" onClick={handleLogout}>Log out</button>
      </header>
      <main className="main">
        <TradeForm onTradePlaced={handleTradePlaced} />
        <TradeHistory refresh={refresh} />
      </main>
    </div>
  );
}
