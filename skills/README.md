# PLIMSOLL Skills

CMC Agent Hub Skills authored by PLIMSOLL.

- **[plimsoll-strategy](plimsoll-strategy/SKILL.md)** — the regime-gated momentum
  barbell strategy as a **backtestable spec** (BNB Hack **Track 2** submission).

## What this Skill does

Most "AI strategy" output is an unfalsifiable vibe. This Skill turns live
CoinMarketCap signals into a **precise, parameterized spec you can backtest**:
every decision states the regime it assumes, the rule that fired, the size the
risk model allows, and a **falsifiable thesis** (what must stay true for it to
work). It is the *same* strategy the live PLIMSOLL agent (Track 1) executes —
one strategy, inspectable as a Skill and runnable as an autonomous agent.

## Example: signals in → strategy spec out

Given live data for an asset, the Skill classifies the market regime, applies the
barbell risk rules, and emits a spec like this:

```json
{
  "asset": "CAKE",
  "regime": "trending",
  "decision": { "direction": "buy", "conviction": 0.7 },
  "thesis": "trending + non-negative funding, RSI 58 (not overbought); holds while regime persists",
  "signals": { "fearGreed": 62, "fundingRate": 0.012, "rsi14": 58, "macdLine": 0.8, "price": 2.35 },
  "rules": {
    "entry": "trending && funding>=0 && rsi14<70 -> buy",
    "exit":  "regime flips risk_off, OR drawdown kill-switch, OR rsi14>=70",
    "sizingPct": 15, "dailyCapPct": 40, "slippageBps": 100,
    "killSwitchDrawdownPct": 20, "barbell": { "corePct": 35, "sleevePct": 65 }
  }
}
```

Because the spec is deterministic, it backtests directly: replay historical OHLCV
through the same regime → decide → size → grade loop and accumulate equity. The
reference implementation's harness does exactly this:

```bash
npm run backtest   # in the repo root — prints equity curve, max drawdown,
                   # trade count, and the learned per-regime weights
```

See **[plimsoll-strategy/SKILL.md](plimsoll-strategy/SKILL.md)** for the full
workflow (signal gathering, the deterministic regime classifier, the risk
constitution, and the skill-vs-luck grading that adapts conviction).

## Install

Copy the skill folder into a CMC-MCP-connected agent's skills directory, then
invoke it by name (`plimsoll-strategy`). It uses only CMC Agent Hub MCP tools
(declared in the skill's `allowed-tools`).
