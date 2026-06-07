# SENTINEL Command — dashboard

The live command console for [SENTINEL](../README.md): the AI proposes, a
deterministic kernel decides, Trust Wallet signs, and the agent learns — rendered
as an instrument-grade dashboard. Next.js + Tailwind + Motion.

## What it shows

- **Decision pipeline** — the six-stage cycle (STATE → SIGNALS → BRAIN → KERNEL →
  EXEC → LEDGER) with the kernel visibly **approving or vetoing** (separation of powers).
- **Latest decision** — regime, direction, conviction gauge, and the LLM's
  *falsifiable thesis*.
- **Equity & risk** — equity sparkline + a drawdown gauge marking the kill-switch
  (20%) and the DQ line (30%).
- **Live signals** — 8 CMC Agent Hub families + on-chain DEX liquidity / flow /
  honeypot + macro watch + trending narratives.
- **Learning** — per-regime confidence weights (skill vs luck).
- **Risk constitution** — the enforced guardrails + the on-chain constitution hash.
- **Backtest** — real Binance candles vs buy-and-hold.
- **Decision ledger** + **on-chain proof** (bscscan tx links).

## Run

```bash
npm install
npm run dev        # http://localhost:3939
```

## Data source

The page reads an agent **state snapshot**, in this order:

1. `SENTINEL_SNAPSHOT` env var (absolute path), else
2. `../snapshot.json` (the file the running agent emits each cycle), else
3. the bundled `data/sample-snapshot.json` (so it's stunning out of the box).

The running agent writes `sentinel/snapshot.json` every cycle (see
`src/ops/snapshot.ts`), so a dashboard hosted next to the agent shows **live state**
(the page is `force-dynamic` and re-reads per request).

## Deploy (Vercel)

```bash
# from this dashboard/ directory
vercel            # or connect the repo in the Vercel dashboard, root = sentinel/dashboard
```

On Vercel there's no agent file present, so it renders the bundled sample snapshot
(a faithful, polished demo). For a *live* public dashboard, host it on the same box
as the agent (or point `SENTINEL_SNAPSHOT` at a synced snapshot) so it reads real
state. `npm run build && npm start` serves it in production mode on port 3939.

## Stack

Next.js 14 (App Router) · Tailwind CSS · Framer Motion · TypeScript. Fonts:
Chakra Petch (display) / JetBrains Mono (data) / IBM Plex Sans (body).
