#!/usr/bin/env bash
# Set ALL Railway env vars for the PLIMSOLL agent service from the local .env +
# the TWAK wallet keystore. The tedious, error-prone part of the deploy — automated.
#
# Prereqs (you run these interactively first — see DEPLOY-RAILWAY.md):
#   railway login                 # browser auth
#   railway init --name plimsoll  # create + link the project
#   railway add --service plimsoll-agent   # create the service (then it's linked)
#
# Then from plimsoll/:  ./scripts/railway-vars.sh [dev|live]   (default: dev = quote-only)
#
# Secrets are read from your local .env + ~/.twak at runtime and pushed to YOUR
# Railway service. Nothing sensitive is written to disk or committed.
set -euo pipefail

cd "$(dirname "$0")/.."  # → plimsoll/
MODE="${1:-dev}"
SERVICE="${RAILWAY_SERVICE:-plimsoll-agent}"

command -v railway >/dev/null || { echo "✗ railway CLI missing — npm i -g @railway/cli"; exit 1; }
railway whoami >/dev/null 2>&1 || { echo "✗ not logged in — run: railway login"; exit 1; }
[ -f .env ] || { echo "✗ .env not found in $(pwd)"; exit 1; }
[ -f "$HOME/.twak/wallet.json" ] || { echo "✗ ~/.twak/wallet.json not found"; exit 1; }
case "$MODE" in dev|live) ;; *) echo "✗ mode must be dev or live"; exit 1;; esac

echo "→ target service: $SERVICE   mode: $MODE"

WB64=$(base64 -i "$HOME/.twak/wallet.json" | tr -d '\n')
CB64=""
[ -f "$HOME/.twak/credentials.json" ] && CB64=$(base64 -i "$HOME/.twak/credentials.json" | tr -d '\n')

# Wallet password — never echoed, never stored. Required for headless signing.
read -rsp "TWAK wallet password (headless signing): " WPW; echo
[ -n "$WPW" ] || { echo "✗ empty password — twak would fail with 'Platform secure storage failure'"; exit 1; }

setvar() {  # setvar KEY VALUE   (value via stdin so it never lands in shell history/ps)
  printf '%s' "$2" | railway variable set "$1" --stdin -s "$SERVICE" --skip-deploys >/dev/null \
    && echo "  ✓ $1"
}

# Non-secret config
setvar PLIMSOLL_MODE "$MODE"
setvar PLIMSOLL_STATE_DIR "/data"
setvar PLIMSOLL_WATCHLIST "CAKE,ETH"
setvar PLIMSOLL_INTERVAL_MS "300000"
setvar LLM_MODEL "claude-opus-4-8"

# Secrets carried over from local .env (only the keys the agent actually needs)
while IFS='=' read -r k v; do
  case "$k" in ''|\#*) continue ;; esac
  case "$k" in
    TWAK_ACCESS_ID|TWAK_HMAC_SECRET|ANTHROPIC_API_KEY|CMC_API_KEY|CMC_MCP_URL|CMC_REST_BASE|\
CMC_X402_BASE|BSC_RPC_URL|BSC_RPC_FALLBACK_URL|BSC_CHAIN_ID|TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID)
      [ -n "$v" ] && setvar "$k" "$v" ;;
  esac
done < .env

# Wallet secrets (not in .env)
setvar TWAK_WALLET_PASSWORD "$WPW"
setvar TWAK_WALLET_JSON_B64 "$WB64"
[ -n "$CB64" ] && setvar TWAK_CREDENTIALS_JSON_B64 "$CB64"

echo
echo "✓ variables set on '$SERVICE' (mode=$MODE)."
echo "Next:"
echo "  railway volume add -m /data -s $SERVICE     # persist learning + drawdown floor"
echo "  railway up -s $SERVICE -d                   # build + deploy (Dockerfile)"
echo "  railway service logs -s $SERVICE            # watch — expect REAL equity (~\$53), not \$1000 stub"
