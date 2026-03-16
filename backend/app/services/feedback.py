import httpx
from dotenv import load_dotenv
import os

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral:7b")


def _build_prompt(trade: dict) -> str:
    side_word = "bought" if trade["side"] == "buy" else "sold"
    return f"""You are UpAlpha, a friendly paper trading coach for beginners.

A beginner just {side_word} {trade['quantity']:.4f} shares of {trade['symbol']} at ${trade['price_at_trade']:.2f} per share, investing ${trade['total_value']:.2f} in total.

In 3-4 short paragraphs, explain:
1. What this trade means in simple terms
2. What factors a beginner should have considered before making this trade (price trend, news, valuation)
3. What risks come with this position
4. One actionable tip they can apply next time

Keep the tone encouraging, clear, and jargon-free. No bullet points — write in plain conversational English."""


async def generate_feedback(trade: dict) -> str:
    prompt = _build_prompt(trade)
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            )
            response.raise_for_status()
            return response.json()["response"].strip()
    except httpx.ConnectError:
        return (
            "AI feedback is unavailable right now — make sure Ollama is running locally "
            "(`ollama serve`) and the mistral model is pulled (`ollama pull mistral`)."
        )
    except Exception as e:
        return f"AI feedback could not be generated: {str(e)}"
