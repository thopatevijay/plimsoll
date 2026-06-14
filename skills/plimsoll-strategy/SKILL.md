---
name: plimsoll-strategy
description: Generate a regime-gated momentum trading strategy for BNB-Chain assets from live CoinMarketCap data, emitted as a backtestable spec with explicit entry/exit rules, a barbell risk allocation, a hard drawdown kill-switch, and a falsifiable thesis per trade. Use when asked to produce, explain, or backtest a crypto trading strategy from market signals.
license: MIT
compatibility: ">=1.0.0"
user-invocable: true
allowed-tools:
  - get_global_metrics_latest
  - get_global_crypto_derivatives_metrics
  - get_crypto_technical_analysis
  - get_crypto_quotes_latest
  - search_cryptos
---

# PLIMSOLL Strategy Skill

Turn live CoinMarketCap signals into a **backtestable trading strategy** for BNB
Chain. This is the strategy brain of the PLIMSOLL agent, authored as a Skill so
its logic can be inspected, backtested, and reproduced independently of any
live-execution layer.

## Core principle

Most "AI strategy" output is an unfalsifiable vibe. This skill emits a
**precise, parameterized spec** you can backtest: every decision states the
regime it assumes, the rule that fired, the size the risk model allows, and a
**falsifiable thesis** (what must stay true for it to work). Skill, not luck:
outcomes are graded on whether the *regime persisted*, separately from PnL.

The strategy is a **regime-gated momentum barbell**:
- a **survival core** that bounds drawdown, and
- an **active sleeve** that only takes momentum risk when the regime supports it.

## When to use

- "Generate a trading strategy for \<asset\> from current market data."
- "What would PLIMSOLL do on \<asset\> right now, and why?"
- "Give me a backtestable spec for a regime-gated momentum strategy."

## Prerequisites

CMC Agent Hub MCP connected (`https://mcp.coinmarketcap.com/mcp`, header
`X-CMC-MCP-API-KEY`). All signals below come from the `allowed-tools`.

## Inputs

- `asset` — symbol (e.g. `CAKE`). Resolve collisions to the canonical coin: call
  `search_cryptos` / `get_crypto_quotes_latest` and pick the **active coin with
  the lowest `cmc_rank`** (multiple coins share a symbol — avoid meme impostors).
- `equityUsd` — account size, for sizing (default 1000 for a spec/backtest).

## Workflow

### 1. Gather signals (the only data the decision may use)
- `get_global_crypto_derivatives_metrics` → `fundingRate.current` (market funding).
- `get_global_metrics_latest` → `sentiment.fear_greed.current.index` (0–100).
- `get_crypto_technical_analysis` (by canonical `id`) → `rsi.rsi14`, `macd.macdLine`.
- `get_crypto_quotes_latest` → price + 24h change.

### 2. Classify the regime (deterministic)
```
fearGreed ≤ 25  OR  funding ≤ −0.05   → risk_off
fearGreed ≥ 55  AND funding ≥ 0  AND macdLine > 0 → trending
otherwise                              → chopping
```

### 3. Decide (regime-gated, low-churn)
```
risk_off                                  → HOLD (sleeve flat; capital in core)
trending AND funding ≥ 0 AND rsi14 < 70   → BUY, conviction 0.7 if greed else 0.5
honeypot/​security flag on the asset       → HOLD (never buy)
otherwise                                 → HOLD (stand aside; no confirmed edge)
```
The thesis must be falsifiable, e.g.: *"Trending regime with non-negative funding
and RSI 55 (not overbought); thesis holds while the regime persists and funding
stays ≥ 0."*

### 4. Apply the risk constitution (BEFORE any size is emitted)
| Rule | Value |
|---|---|
| Allowlist | the 148 CMC-eligible BEP-20 tokens only (official list states 149; SLX duplicated) |
| Per-trade cap | 15% of equity |
| Daily volume cap | 40% of equity |
| Slippage cap | 100 bps |
| Hard drawdown kill-switch | 20% (DQ line is ~30% — 10-pt buffer) |
| Allocation (barbell) | 35% survival core / 65% active sleeve |
| Min trades/day | 1 (survival-core qualifier) |

`size = min(perTradeCap × conviction, perTradeCap, dailyRemaining)`. If the
drawdown kill-switch is tripped, the sleeve goes flat regardless of signal.

### 5. Learn (skill vs luck)
After a holding horizon, grade the decision:
- `pnl` from the price move (direction-aware).
- `thesisHeld` = the regime **persisted** (detector at entry == detector now).
- grade: regime held + win → +1.0; win but regime flipped → +0.3 (lucky);
  regime held + loss → −0.3 (bad luck); regime broke + loss → −1.0.
The grade nudges a per-regime confidence weight (bounded [0.5, 1.5]) that scales
future conviction in that regime — the strategy gets more cautious where it has
been wrong.

## Output: the backtestable spec

Emit this object (the spec a backtester consumes):

```json
{
  "asset": "CAKE",
  "regime": "trending",
  "decision": { "direction": "buy", "conviction": 0.7 },
  "thesis": "trending + non-negative funding, RSI 55 (not overbought); holds while regime persists",
  "signals": { "fearGreed": 62, "fundingRate": 0.012, "rsi14": 55, "macdLine": 0.8, "price": 2.34 },
  "rules": {
    "regime": "fg<=25||funding<=-0.05 -> risk_off; fg>=55&&funding>=0&&macd>0 -> trending; else chopping",
    "entry": "trending && funding>=0 && rsi14<70 -> buy",
    "exit": "regime flips to risk_off, OR drawdown kill-switch, OR rsi14>=70",
    "sizingPct": 15, "dailyCapPct": 40, "slippageBps": 100,
    "killSwitchDrawdownPct": 20, "barbell": { "corePct": 35, "sleevePct": 65 }
  }
}
```

## Backtest methodology

The spec is deterministic, so it backtests directly: replay historical daily
OHLCV through steps 2–5 and accumulate equity. Report **total return, max
drawdown, trade count, win rate, and the learned regime weights**. The reference
harness — `npm run backtest [SYMBOL]` in the PLIMSOLL repo — does exactly this over
**real daily candles from free Binance klines** (RSI/MACD from real closes; F&G
proxied from momentum where free history lacks it), versus a buy-and-hold benchmark.

**Evidence (≈329 real daily candles, a bearish window):**

| Asset | Buy & hold | PLIMSOLL | Max drawdown |
|---|---|---|---|
| CAKE | −47.4% | **−4.3%** | 9.9% |
| ETH | −45.1% | **−3.8%** | 5.7% |
| BNB | −13.8% | **0.0%** (stood aside) | 0.0% |

The regime gate kept capital nearly flat through a 45%+ drawdown in the underlying —
the survival thesis: most return **without breaching the drawdown gate**, net of
simulated costs, by low-churn design. (This window was down-trending, so it shows
the defensive side; upside capture appears in trending-up windows.)

## Tool-failure fallbacks

A missing signal must never crash the decision — degrade gracefully:
- no funding → treat as `flat` (0); no Fear & Greed → `neutral` (50);
- no RSI/MACD → omit the technical confirmation (regime falls back to chopping →
  HOLD), never a blind buy;
- symbol unresolvable to a canonical id → HOLD.

## Notes

This skill is intentionally conservative and low-churn (the daily-trade minimum
is met by the survival core, not by over-trading the sleeve). It is the same
strategy the PLIMSOLL live agent executes — one strategy, inspectable as a Skill
and runnable as an autonomous agent.
