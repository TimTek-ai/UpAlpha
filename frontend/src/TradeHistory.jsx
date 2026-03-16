import { useEffect, useState } from "react";
import api from "./api";
import FeedbackCard from "./FeedbackCard";

export default function TradeHistory({ refresh }) {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/trades/")
      .then(({ data }) => setTrades(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refresh]);

  if (loading) return <p className="muted center">Loading trades…</p>;
  if (trades.length === 0) return <p className="muted center">No trades yet. Place your first one above!</p>;

  return (
    <div>
      <h2>Your Trades</h2>
      <div className="trade-list">
        {trades.map(trade => (
          <FeedbackCard key={trade.id} trade={trade} />
        ))}
      </div>
    </div>
  );
}
