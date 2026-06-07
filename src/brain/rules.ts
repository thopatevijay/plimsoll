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

export function ruleProposer(bundle: SignalBundle): Proposal {
  const regime = detectRegime(bundle);
  const f = summarize(bundle);

  if (f.honeypot) return hold(bundle, regime, "honeypot flagged — stay out");
  // On-chain safety gate: refuse thin DEX liquidity (undefined = unverified → allow).
  const liq = bundle.chain.liquidityUsd;
  if (liq !== undefined && liq < MIN_LIQUIDITY_USD) {
    return hold(bundle, regime, `thin DEX liquidity ($${Math.round(liq).toLocaleString()})`);
  }
  if (regime === "risk_off") return hold(bundle, regime, "risk-off — sleeve flat");

  if (regime === "trending" && f.funding !== "negative" && f.rsi !== "overbought") {
    const conviction = f.sentiment === "greed" || f.sentiment === "extreme_greed" ? 0.7 : 0.5;
    return {
      regime,
      asset: bundle.asset,
      direction: "buy",
      conviction,
      thesis: "trending regime with supportive funding and not overbought",
    };
  }

  return hold(bundle, regime, "no confirmed edge — standing aside");
}

function hold(bundle: SignalBundle, regime: Regime, why: string): Proposal {
  return { regime, asset: bundle.asset, direction: "hold", conviction: 0, thesis: why };
}
