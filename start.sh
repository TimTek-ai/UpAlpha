#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}"
echo "  _   _       _    _       _           "
echo " | | | |_ __ / \  | |_ __ | |__   __ _ "
echo " | | | | '_ / _ \ | | '_ \| '_ \ / _\` |"
echo " | |_| | |_) / ___ \| | |_) | | | | (_| |"
echo "  \___/| .__/_/   \_\_| .__/|_| |_|\__,_|"
echo "       |_|             |_|               "
echo -e "${NC}"

echo -e "${CYAN}Starting UpAlpha...${NC}"
echo ""

# ── Cleanup on exit ───────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down...${NC}"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  echo "Goodbye."
}
trap cleanup EXIT INT TERM

# ── Backend ───────────────────────────────────────────────────────────────────
echo -e "${GREEN}[backend]${NC} Starting FastAPI on http://localhost:8000"
cd "$BACKEND"
uvicorn app.main:app --reload --port 8000 \
  2>&1 | sed 's/^/\033[0;32m[backend]\033[0m /' &
BACKEND_PID=$!

# ── Wait for backend to be ready ─────────────────────────────────────────────
echo -e "${GREEN}[backend]${NC} Waiting for API to be ready..."
for i in $(seq 1 20); do
  if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}[backend]${NC} Ready ✓"
    break
  fi
  sleep 0.5
done

# ── Frontend ──────────────────────────────────────────────────────────────────
echo -e "${CYAN}[frontend]${NC} Starting Vite on http://localhost:5173"
cd "$FRONTEND"
npm run dev \
  2>&1 | sed 's/^/\033[0;36m[frontend]\033[0m /' &
FRONTEND_PID=$!

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${GREEN}Backend${NC}  → http://localhost:8000"
echo -e "  ${CYAN}Frontend${NC} → http://localhost:5173"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop everything."
echo ""

wait
