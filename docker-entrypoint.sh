#!/bin/sh
# Materialize the headless runtime state, then hand off to the agent.
# Secrets arrive as env vars (Railway/host); nothing sensitive is baked into the image.
set -e

# 1. State dir (Railway volume mount). Safe if it already exists.
mkdir -p "${PLIMSOLL_STATE_DIR:-/data}"

# 2. TWAK wallet + credentials — no OS keychain on a server, so reconstruct the
#    encrypted keystore from base64 env vars into ~/.twak. The agent then signs via
#    `twak swap --password "$TWAK_WALLET_PASSWORD"` (set in the host env).
mkdir -p "$HOME/.twak"
if [ -n "$TWAK_WALLET_JSON_B64" ]; then
  echo "$TWAK_WALLET_JSON_B64" | base64 -d > "$HOME/.twak/wallet.json"
  echo "[entrypoint] wrote ~/.twak/wallet.json"
fi
if [ -n "$TWAK_CREDENTIALS_JSON_B64" ]; then
  echo "$TWAK_CREDENTIALS_JSON_B64" | base64 -d > "$HOME/.twak/credentials.json"
  echo "[entrypoint] wrote ~/.twak/credentials.json"
fi

# 3. Run the continuous live runner. PLIMSOLL_MODE / WATCHLIST / INTERVAL come from env.
echo "[entrypoint] starting PLIMSOLL (mode=${PLIMSOLL_MODE:-dev}, state=${PLIMSOLL_STATE_DIR:-/data})"
exec npm run dev
