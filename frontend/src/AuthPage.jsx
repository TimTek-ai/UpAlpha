import { useState } from "react";
import api from "./api";

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login");
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
      if (!err.response) {
        setError(`Cannot reach server — network error. API URL: ${import.meta.env.VITE_API_URL || "http://localhost:8000 (VITE_API_URL not set!)"}`);
      } else {
        setError(err.response.data?.detail || `Server error ${err.response.status}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">UpAlpha</div>
        <div className="auth-tagline">Your paper trading coach</div>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")}>Log in</button>
          <button className={`auth-tab ${mode === "signup" ? "active" : ""}`} onClick={() => setMode("signup")}>Sign up</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
