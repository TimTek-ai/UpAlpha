"""
Unified AI text generation.
Priority:
  1. MISTRAL_API_KEY is set  →  Mistral API (works in production)
  2. Fallback                →  Ollama local (works in dev)
"""
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

MISTRAL_API_KEY  = os.getenv("MISTRAL_API_KEY")
MISTRAL_MODEL    = os.getenv("MISTRAL_MODEL", "mistral-small-latest")
OLLAMA_BASE_URL  = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL     = os.getenv("OLLAMA_MODEL", "mistral:7b")


async def generate(prompt: str) -> str:
    if MISTRAL_API_KEY:
        return await _mistral_api(prompt)
    return await _ollama(prompt)


async def _mistral_api(prompt: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {MISTRAL_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MISTRAL_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        return f"AI feedback unavailable: {e}"


async def _ollama(prompt: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            )
            resp.raise_for_status()
            return resp.json()["response"].strip()
    except httpx.ConnectError:
        return (
            "AI feedback is unavailable — set MISTRAL_API_KEY in your .env "
            "or run Ollama locally (`ollama serve`)."
        )
    except Exception as e:
        return f"AI feedback unavailable: {e}"
