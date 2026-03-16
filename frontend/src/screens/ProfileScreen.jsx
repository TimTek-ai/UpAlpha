import { useEffect, useState } from "react";
import api from "../api";

export default function ProfileScreen({ onLogout }) {
  const [user, setUser] = useState(null);
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    api.get("/auth/me").then(({ data }) => setUser(data)).catch(() => {});
    api.get("/trades/").then(({ data }) => setTrades(data)).catch(() => {});
  }, []);

  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : "—";

  const totalInvested = trades.reduce((s, t) => s + t.total_value, 0);

  return (
    <div className="screen">
      <p className="screen-title">Profile</p>

      <div className="profile-avatar">👤</div>
      <p className="profile-email">{user?.email || "…"}</p>

      <div className="profile-section">
        <div className="profile-section-title">Account</div>
        <div className="profile-item">
          <span>Member since</span>
          <span className="val">{joined}</span>
        </div>
        <div className="profile-item">
          <span>Account type</span>
          <span className="val">Paper trading</span>
        </div>
      </div>

      <div className="profile-section">
        <div className="profile-section-title">Stats</div>
        <div className="profile-item">
          <span>Total trades</span>
          <span className="val">{trades.length}</span>
        </div>
        <div className="profile-item">
          <span>Total invested</span>
          <span className="val">${totalInvested.toFixed(2)}</span>
        </div>
      </div>

      <button className="btn-secondary" style={{ marginTop: "1rem" }} onClick={onLogout}>
        Log out
      </button>
    </div>
  );
}
