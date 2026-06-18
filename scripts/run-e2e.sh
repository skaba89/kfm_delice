#!/bin/bash
# scripts/run-e2e.sh — start dev server, wait, run e2e-live.py, kill server, exit with results
set -u

cd "$(dirname "$0")/.."
PATH="$PWD/node_modules/.bin:$PATH"

# 1. Kill any stale next processes
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null
sleep 3

# 2. Start dev server in background
echo "[run-e2e] Starting Next.js dev server..."
# Use higher rate limits for testing (default 60/min is too low for 43+ test requests)
NODE_OPTIONS="--max-old-space-size=1024" \
API_RATE_LIMIT=1000 \
API_RATE_WINDOW_MS=60000 \
AUTH_RATE_LIMIT=1000 \
AUTH_RATE_WINDOW_MS=60000 \
nohup next dev -p 3000 -H 127.0.0.1 > /tmp/kfm-dev.log 2>&1 &
SERVER_PID=$!
echo "[run-e2e] Server PID: $SERVER_PID"

# 3. Wait for /api/health to respond
echo "[run-e2e] Waiting for server to be ready..."
READY=0
for i in $(seq 1 60); do
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "[run-e2e] Server process exited unexpectedly"
    tail -20 /tmp/kfm-dev.log
    exit 1
  fi
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/health 2>/dev/null || echo "000")
  if [ "$HTTP" = "200" ] || [ "$HTTP" = "401" ] || [ "$HTTP" = "403" ]; then
    echo "[run-e2e] Server ready after ${i}s (HTTP=$HTTP)"
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" != "1" ]; then
  echo "[run-e2e] Server not ready after 60s"
  tail -30 /tmp/kfm-dev.log
  kill -9 $SERVER_PID 2>/dev/null
  exit 1
fi

# 4. Run e2e tests
echo "[run-e2e] Running e2e-live.py..."
python3 scripts/e2e-live.py
EXIT_CODE=$?

# 5. Kill server
echo "[run-e2e] Stopping server (PID $SERVER_PID)..."
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null

exit $EXIT_CODE
