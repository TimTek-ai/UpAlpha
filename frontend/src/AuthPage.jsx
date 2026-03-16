import { useState } from "react";
import api from "./api";

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post(`/auth/${mode}`, { email, password });
      localStorage.setItem("token", data.access_token);
      onLogin();
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h1 className="logo">UpAlpha</h1>
        <p className="tagline">Your paper trading coach</p>

        <div className="tab-row">
          <button className={mode === "login" ? "tab active" : "tab"} onClick={() => setMode("login")}>Log in</button>
          <button className={mode === "signup" ? "tab active" : "tab"} onClick={() => setMode("signup")}>Sign up</button>
        </div>

        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
