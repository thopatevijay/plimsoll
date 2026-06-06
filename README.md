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

```
┌──────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                             │
│                                                                        │
│   CoinMarketCap AI Agent Hub          Trust Wallet Agent Kit (TWAK)    │
│   ┌───────────────────────┐           ┌────────────────────────────┐  │
│   │ MCP tools · DEX API    │           │ self-custodial signing      │  │
│   │ funding · F&G · TA     │           │ spot swap · automate · x402 │  │
│   │ x402 paid endpoints    │◀──pay─────│ (sole execution layer)      │  │
│   └───────────┬───────────┘   x402     └─────────────┬──────────────┘  │
│               │ data                                 │ signed tx        │
└───────────────┼──────────────────────────────────────┼─────────────────┘
                │                                      │
                ▼                                      ▼
┌──────────────────────────────────────────────────────────────────────┐
│                            SENTINEL AGENT                              │
│                                                                        │
│   ┌─────────────┐   ┌──────────────┐   ┌──────────────┐   ┌─────────┐ │
│   │  signals/   │   │    brain/    │   │   kernel/    │   │  exec/  │ │
│   │  fetch +    │──▶│  LLM proposes│──▶│ deterministic│──▶│  TWAK   │ │
│   │  normalize  │   │  {regime,    │   │ risk checks: │   │  swap / │ │
│   │  (CMC +     │   │   asset, dir,│   │ allowlist,   │   │ automate│ │
│   │   chain)    │   │   conviction,│   │ sizing,      │   │ (signs  │ │
│   │  paid x402  │   │   thesis}    │   │ drawdown     │   │ locally)│ │
│   └─────────────┘   │  NEVER signs │   │ kill-switch  │   └────┬────┘ │
│                     └──────────────┘   └──────────────┘        │      │
│                            ▲                                   │      │
│                            │ learned weights                   ▼      │
│                     ┌──────┴───────────────────────────────────────┐ │
│                     │              ledger/  (append-only)           │ │
│                     │  signals → thesis → verdict → tx → outcome →  │ │
│                     │  self-grade → weight update  (thought-stream) │ │
│                     └───────────────────────────────────────────────┘ │
│                                                                        │
│   identity/  →  ERC-8004 on-chain agent identity + committed rules     │
└──────────────────────────────────────────────────────────────────────┘
                │                                      │
                ▼                                      ▼
        OpenAI (gpt-4o-mini)                   BNB Smart Chain
        provider-agnostic brain                spot DEX (1inch/KyberSwap/0x)
```

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
npm test                 # unit tests (risk kernel)
npm run typecheck        # strict TS
npm run tracer           # the end-to-end pipe (runs keyless with stubs)
```

The risk kernel is the most-tested unit — every limit (allowlist, sizing,
drawdown kill-switch, conviction scaling) has a test, because it's the floor
that keeps the agent inside its rules.

## Status

Active build — BNB Hack, June 2026. Tracer-bullet skeleton in place
(signal → brain → kernel → exec → ledger proven end to end); layers thickened
phase by phase.

## License

MIT
