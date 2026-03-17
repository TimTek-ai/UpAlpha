"""
Unified AI text generation.
Priority:
  1. GROQ_API_KEY is set    →  Groq API  (llama-3.1-8b-instant)
  2. MISTRAL_API_KEY is set →  Mistral API (fallback)
  3. Neither set            →  error message
"""
import os
from groq import AsyncGroq
import httpx
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY    = os.getenv("GROQ_API_KEY")
GROQ_MODEL      = "llama-3.1-8b-instant"

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
MISTRAL_MODEL   = os.getenv("MISTRAL_MODEL", "mistral-small-latest")


async def generate(prompt: str) -> str:
    if GROQ_API_KEY:
        return await _groq(prompt)
    if MISTRAL_API_KEY:
        return await _mistral(prompt)
    return "AI feedback unavailable — add GROQ_API_KEY to your .env file."


async def _groq(prompt: str) -> str:
    try:
        client = AsyncGroq(api_key=GROQ_API_KEY)
        chat   = await client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
        )
        return chat.choices[0].message.content.strip()
    except Exception as e:
        return f"AI feedback unavailable: {e}"


async def _mistral(prompt: str) -> str:
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
