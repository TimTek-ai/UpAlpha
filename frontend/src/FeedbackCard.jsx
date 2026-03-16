import { useState } from "react";
import api from "./api";

export default function FeedbackCard({ trade }) {
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  async function fetchFeedback() {
    setLoading(true);
    try {
      const { data } = await api.post(`/trades/${trade.id}/feedback`);
      setFeedback(data.ai_text);
    } catch {
      setFeedback("Could not load feedback. Make sure Ollama is running.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card feedback-card">
      <div className="trade-summary">
        <span className={`side-badge ${trade.side}`}>{trade.side.toUpperCase()}</span>
        <strong>{trade.symbol}</strong>
        <span className="muted">{trade.quantity} shares @ ${trade.price_at_trade.toFixed(2)}</span>
        <span className="muted total">${trade.total_value.toFixed(2)}</span>
        <span className={`status-badge ${trade.status}`}>{trade.status}</span>
      </div>

      {!feedback && (
        <button className="btn-secondary" onClick={fetchFeedback} disabled={loading}>
          {loading ? "Generating AI feedback…" : "Get AI coaching"}
        </button>
      )}

      {feedback && (
        <div className="feedback-text">
          <h4>AI Coach says</h4>
          <p>{feedback}</p>
        </div>
      )}
    </div>
  );
}
