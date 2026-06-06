# SENTINEL

**An autonomous BNB-Chain trading agent that reads the chain natively, pays its
own way via x402, and learns from every trade — kept inside the rules you set by
a deterministic risk kernel.**

Built for **BNB Hack: AI Trading Agent Edition** (CoinMarketCap × Trust Wallet × BNB Chain).

---

## The problem

Autonomous LLM trading agents are black boxes. You're asked to *trust* one with
your wallet — but you can't see why it traded, can't audit whether it followed
your rules, and can't bound the damage. So nobody actually lets one run
unattended.

SENTINEL is built to be *run*, not just trusted:

- **Reads the chain natively** — DEX pool imbalance, liquidity shifts, wallet
  flows, and honeypot checks (CoinMarketCap DEX API), plus funding rates, Fear &
  Greed, and technicals. Edge from real on-chain state, not a priced-in feed.
- **Pays its own way** — fetches data per-call via **x402** machine-to-machine
  micropayments. No API-key plumbing; the agent funds its own data.
- **Learns live** — every trade is self-graded against its thesis; the outcome
  updates the confidence weights the brain uses next time. The decision ledger
  is a watchable thought-stream.
- **Safe by construction** — a pure, deterministic **risk kernel** enforces a
  token allowlist, position & slippage limits, and a hard drawdown kill-switch
  *before anything is signed*. Spot only. Self-custodial signing via the Trust
  Wallet Agent Kit — keys never leave the machine.

---

## System architecture

![SENTINEL system architecture](docs/architecture.svg)

<sub>The AI suggests · the deterministic risk kernel decides · Trust Wallet signs (your keys stay local) · the agent learns from every trade.</sub>

## The trade loop

1. **`signals/`** fetches a normalized `SignalBundle` — CMC families (funding,
   Fear & Greed, technicals) + chain-native (DEX imbalance, wallet flows,
   honeypot check). At least one source is paid per-call via **x402**.
2. **`brain/`** (the LLM) proposes one decision — `{ regime, asset, direction,
   conviction, thesis }` — with a *falsifiable* thesis. It never sizes and never
   signs.
3. **`kernel/`** (pure, deterministic) checks the proposal against the
   committed **constitution**: token allowlist, conviction-scaled sizing within
   per-trade/daily caps, slippage cap, and a hard drawdown kill-switch. It emits
   a sized order or a logged rejection.
4. **`exec/`** executes approved orders via **TWAK** — self-custodial local
   signing, the sole execution layer. The daily qualifying trade runs as a TWAK
   `automate` job (native autonomous mode).
5. **`ledger/`** records the full trace; once the trade resolves it is
   self-graded and the outcome updates the brain's confidence weights for the
   next decision.

## Why each integration is load-bearing

- **Trust Wallet Agent Kit** is the *sole* execution layer, used across multiple
  surfaces — local signing, autonomous (`automate`) mode, and native x402 — not
  a single swap call. Keys and signing authority stay local end to end.
- **CoinMarketCap AI Agent Hub** drives every decision: signals via MCP/DEX API,
  paid per-call via x402, with each trade's memo attributing the signals that
  triggered it.
- **BNB AI Agent SDK** registers the agent's **ERC-8004** on-chain identity and
  commits the hash of its risk constitution before trading — public, accountable.

## Tech stack

TypeScript · viem · CoinMarketCap AI Agent Hub (MCP + x402) · Trust Wallet Agent
Kit · BNB AI Agent SDK (ERC-8004) · OpenAI (provider-agnostic brain).

## Project layout

```
src/
  signals/   data + edge layer (CMC + chain-native, x402-paid)
  brain/     LLM proposer (provider-agnostic; never signs)
  kernel/    deterministic risk kernel (pure, fully unit-tested)
  exec/      TWAK adapter — swap / automate / x402 (sole execution)
  ledger/    append-only decision ledger + learning loop
  identity/  ERC-8004 identity + constitution commitment
  agent.ts   the loop
constitution.json   the committed risk rules
test/        kernel unit tests
```

## Run

```bash
npm install
cp .env.example .env     # fill in keys (see .env.example)
npm test                 # unit tests (88, deterministic + offline)
npm run typecheck        # strict TS
npm run tracer           # one decision cycle, end to end (real data, dry-run quote)
npm run signals BNB      # inspect the live signal bundle for a symbol
npm run backtest         # replay the full loop + learning on a synthetic scenario
npm run dev              # the unattended live-week runner (SENTINEL_MODE=live to trade)
```

**Modes:** `SENTINEL_MODE=dev` (default) runs *dry-run-live* — real signals, real
LLM, real on-chain quotes, but no signing/spend. `SENTINEL_MODE=live` executes
real swaps + pays for data via x402 (needs a funded wallet).

The risk kernel is the most-tested unit — every limit (allowlist, sizing,
drawdown kill-switch, conviction scaling) has a test, because it's the floor
that keeps the agent inside its rules.

## Two tracks, one strategy

The same regime-gated momentum barbell powers both the live agent (Track 1) and a
**backtestable CMC Skill** (Track 2): [`skills/sentinel-strategy/SKILL.md`](skills/sentinel-strategy/SKILL.md).
Inspectable as a Skill, runnable as an autonomous agent.

## Status

Active build — BNB Hack, June 2026. Full pipeline live end-to-end: chain equity →
real CMC signals (REST + Agent Hub MCP, x402 pay-per-call) → LLM brain → risk
kernel → self-custodial TWAK execution → decision ledger → outcome→learning. The
agent learns from its own track record (per-regime confidence weights) and is
bounded by a hard drawdown kill-switch.

## License

MIT
