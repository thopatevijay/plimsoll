import { detectRegime } from "../regime/index.js";
import { MIN_LIQUIDITY_USD } from "../kernel/index.js";
import { summarize } from "../signals/features.js";
import type { Proposal, Regime, SignalBundle } from "../types.js";

// Deterministic rule-based proposer. Two roles:
//  1) a baseline "brain" so the FULL pipeline (incl. the learning loop) runs and
//     is testable WITHOUT an LLM key — used by the backtest and as the keyless
//     fallback in propose().
//  2) a sanity baseline to compare the LLM against (does the model beat rules?).
//
// Intentionally conservative + low-churn: it only buys a confirmed trending setup
// and otherwise stands aside (the daily qualifier handles the trade minimum).
//
// CHURN DISCIPLINE (2.4): TWAK's measured round-trip cost is ~1.4% (break-even
// ~1.7%), so a weak setup is negative-expectancy — frequency is not a profit
// driver (see [[bnbhack-tx-cost-findings]]). We therefore demand a SECOND,
// independent confirmation beyond "regime is trending": RSI must sit in the
// confirmed-momentum band (>= midline, below overbought). This drops the marginal
// trades where price popped on momentum but RSI never confirmed — fewer, higher-edge
// trades, less fee drag. This is a code-only tightening of the proposer; it does
// NOT touch the on-chain constitution (no hash change, no break-even calibration).
const RSI_MOMENTUM_FLOOR = 50; // confirm the uptrend, not a sub-midline bounce
const RSI_OVERBOUGHT = 70; // rsiZone's overbought edge — no chasing extended moves
const RSI_STRONG = 60; // above this (but not overbought) = strong confirmation

export function ruleProposer(bundle: SignalBundle): Proposal {
  const regime = detectRegime(bundle);
  const f = summarize(bundle);

  if (f.honeypot) return hold(bundle, regime, "honeypot flagged — stay out");
  // On-chain safety gate: refuse thin DEX liquidity (undefined = unverified → allow).
  const liq = bundle.chain.liquidityUsd;
  if (liq !== undefined && liq < MIN_LIQUIDITY_USD) {
    return hold(bundle, regime, `thin DEX liquidity ($${Math.round(liq).toLocaleString()})`);
  }
  // Risk-off = ACTIVELY de-risk: propose a sell to flatten the active sleeve. This
  // is the survival mechanism we claim — going flat in a crash, not merely declining
  // to add. The kernel sizes it to the held position and no-ops if we're already
  // flat (so a sustained risk-off tape just re-confirms flat at zero cost).
  if (regime === "risk_off") {
    return { regime, asset: bundle.asset, direction: "sell", conviction: 1, thesis: "risk-off — flatten the active sleeve (survival)" };
  }

  if (regime === "trending" && f.funding !== "negative") {
    // Second confirmation: RSI must confirm momentum. Missing RSI = no confirmation
    // → stand aside (low-churn bias). Below the midline or overbought → no edge.
    const rsi = bundle.cmc.rsi;
    if (rsi === undefined || rsi < RSI_MOMENTUM_FLOOR || rsi >= RSI_OVERBOUGHT) {
      return hold(bundle, regime, "trend unconfirmed by RSI — standing aside (cost discipline)");
    }
    const conviction = rsi >= RSI_STRONG ? 0.75 : 0.6;
    return {
      regime,
      asset: bundle.asset,
      direction: "buy",
      conviction,
      thesis: `trending regime, RSI ${Math.round(rsi)} confirms momentum (>= ${RSI_MOMENTUM_FLOOR}, not overbought), funding supportive`,
    };
  }

  return hold(bundle, regime, "no confirmed edge — standing aside");
}

function hold(bundle: SignalBundle, regime: Regime, why: string): Proposal {
  return { regime, asset: bundle.asset, direction: "hold", conviction: 0, thesis: why };
}
