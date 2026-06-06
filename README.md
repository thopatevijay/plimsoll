# SENTINEL

**An autonomous BNB-Chain trading agent that reads the chain natively, pays its
own way via x402, and learns from every trade — kept inside the rules you set by
a deterministic risk kernel.**

Built for BNB Hack: AI Trading Agent Edition (CoinMarketCap × Trust Wallet × BNB Chain).

---

## The idea

Most autonomous trading agents are black boxes you have to *trust* with your
wallet. SENTINEL is built to be *run* unattended: an LLM proposes trades from
real on-chain + market signals, but a deterministic **risk kernel** enforces
your limits before anything is signed, and a **decision ledger** records *why*
every trade happened — and learns from how it turned out.

- **Reads the chain natively** — DEX imbalance, liquidity shifts, wallet flows,
  honeypot checks (CMC DEX API) + funding rates, Fear & Greed, technicals.
- **Pays its own way** — fetches data per-call via x402 (machine-to-machine
  micropayments), no API-key plumbing.
- **Learns live** — each trade is self-graded; the outcome updates the
  confidence weights the brain uses next time. The ledger is a watchable
  thought-stream.
- **Safe by construction** — a pure, deterministic kernel enforces a 149-token
  allowlist, position/slippage limits, and a hard drawdown kill-switch. Spot
  only. Self-custodial signing via the Trust Wallet Agent Kit.

## Architecture

```
 Signals (CMC + chain-native, paid via x402)
        → Brain (LLM proposes; never sizes, never signs)
        → Risk Kernel (deterministic: allowlist, sizing, drawdown kill-switch)
        → Execution (Trust Wallet Agent Kit — self-custodial, spot)
        → Decision Ledger (self-grades → learns → thought-stream)
   + ERC-8004 on-chain agent identity & committed constitution
```

`src/signals` · `src/brain` · `src/kernel` · `src/exec` · `src/ledger` ·
`src/agent.ts` (the loop).

## Run

```bash
npm install
cp .env.example .env     # fill in keys (see .env.example)
npm test                 # unit tests (risk kernel)
npm run tracer           # the end-to-end pipe (runs keyless with stubs)
```

## Status

Active build (BNB Hack, June 2026). Tracer-bullet skeleton in place; layers
thickened phase by phase. See the agent's decision ledger for live reasoning.

## Stack

TypeScript · viem · CoinMarketCap AI Agent Hub (MCP + x402) · Trust Wallet Agent
Kit · BNB AI Agent SDK (ERC-8004 identity) · OpenAI (provider-agnostic brain).

## License

MIT
