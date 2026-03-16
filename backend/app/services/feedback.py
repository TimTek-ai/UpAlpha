from app.services.ai import generate


def _build_prompt(trade: dict) -> str:
    side_word = "bought" if trade["side"] == "buy" else "sold"
    reason_line = f'\nTheir reason for trading: "{trade["reason"]}"' if trade.get("reason") else ""
    return f"""You are UpAlpha, a friendly paper trading coach for beginners.

A beginner just {side_word} {trade['quantity']:.4f} shares of {trade['symbol']} at ${trade['price_at_trade']:.2f} per share, investing ${trade['total_value']:.2f} in total.{reason_line}

In 3-4 short paragraphs, explain:
1. What this trade means in simple terms
2. What factors a beginner should have considered before making this trade (price trend, news, valuation)
3. What risks come with this position
4. One actionable tip they can apply next time

Keep the tone encouraging, clear, and jargon-free. No bullet points — write in plain conversational English."""


async def generate_feedback(trade: dict) -> str:
    return await generate(_build_prompt(trade))
