# UpAlpha

A paper trading coach for beginner investors. Practice reading charts, learn candlestick patterns, backtest strategies, and get AI-powered feedback — all with fake money.

**Stack:** React · FastAPI · SQLite/PostgreSQL · Groq AI · yfinance · Alpaca (paper trading)

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- A free [Groq API key](https://console.groq.com)

### 1. Clone the repo
```bash
git clone https://github.com/TimTek-ai/UpAlpha.git
cd UpAlpha
```

### 2. Backend setup
```bash
cd backend
cp .env.example .env          # then fill in your keys
pip install -r requirements.txt
```

Edit `.env` and set at minimum:
```
SECRET_KEY=any-long-random-string
GROQ_API_KEY=your_groq_key
DATABASE_URL=sqlite+aiosqlite:///./upalpha.db
```

### 3. Frontend setup
```bash
cd ../frontend
npm install
cp .env.example .env.local    # no changes needed for local dev
```

### 4. Start everything
```bash
cd ..
./start.sh
```

- Backend → http://localhost:8000
- Frontend → http://localhost:5173

---

## Production Deployment

### Database — Neon (free PostgreSQL)
1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string — it looks like:
   `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`
4. Change the scheme to `postgresql+asyncpg://...` for async SQLAlchemy

### Backend — Render (free tier)
1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repo `TimTek-ai/UpAlpha`
3. Set **Root Directory** to `backend`
4. Set **Build Command**: `pip install -r requirements.txt`
5. Set **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | your Neon connection string (`postgresql+asyncpg://...`) |
| `SECRET_KEY` | a long random string |
| `GROQ_API_KEY` | your Groq key |
| `ALLOWED_ORIGINS` | `*` |

7. Click **Deploy**. Your backend URL will be `https://upalpha-backend.onrender.com`

### Frontend — Netlify (free tier)
1. Go to [netlify.com](https://netlify.com) → Add new site → Import from Git
2. Connect your GitHub repo `TimTek-ai/UpAlpha`
3. Set **Base directory**: `frontend`
4. Set **Build command**: `npm run build`
5. Set **Publish directory**: `frontend/dist`
6. Add environment variable:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://upalpha-backend.onrender.com` |

7. Click **Deploy site**

---

## Environment Variables

See `backend/.env.example` for all backend variables.

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | ✅ | JWT signing secret — make it long and random |
| `DATABASE_URL` | ✅ | SQLite (dev) or PostgreSQL+asyncpg (prod) |
| `GROQ_API_KEY` | ✅ | AI feedback — free at console.groq.com |
| `ALLOWED_ORIGINS` | ✅ | `*` for beta, comma-separated URLs for production |
| `MISTRAL_API_KEY` | ❌ | Fallback AI if Groq not set |
| `ALPACA_API_KEY` | ❌ | Paper trading — free at app.alpaca.markets |
| `SMTP_USER` / `SMTP_PASS` | ❌ | Welcome emails — Gmail App Password |

---

## Features

| Tab | What it does |
|-----|-------------|
| **Home** | P&L dashboard, weekly chart, AI coaching insight |
| **Trade** | Paper trade real stocks with live prices |
| **Train** | Candlestick game — predict next candle, earn XP |
| **Learn** | Pattern recognition quiz + strategy scenario quizzes |
| **History** | Full trade history |
| **Profile** | Account settings |
