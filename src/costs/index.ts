import type { Constitution } from "../types.js";

// SIMULATED TRANSACTION-COST MODEL.
//
// The competition scores net on-chain % return and notes that "simulated tx costs
// apply" — but the organizers have NOT yet published the exact model (Stefano:
// "don't calibrate break-even yet, confirming"). So this lives OUTSIDE the on-chain
// constitution (it is not a risk rule the kernel enforces, and we don't want to
// re-commit the constitution hash every time we recalibrate). It is a pure,
// env-tunable estimate used to keep the backtest HONEST and to quantify churn drag.
//
// Defaults are deliberately conservative for a TWAK spot swap on BSC:
//   - swapFeeBps 25     PancakeSwap-style 0.25% pool fee (the dominant cost).
//   - estSlippageBps 15 conservative effective slippage; we already gate liquidity
//                       >= $50k and cap max slippage at 100 bps, so 0.15% is realistic.
//   - fixedGasUsd 0.20  ~BSC gas per swap; fixed-$, so it bites small trades hardest.
export interface CostModel {
  swapFeeBps: number;
  estSlippageBps: number;
  fixedGasUsd: number;
}

export const DEFAULT_COST_MODEL: CostModel = {
  swapFeeBps: 25,
  estSlippageBps: 15,
  fixedGasUsd: 0.2,
};

/** One leg (a single swap): proportional fee+slippage on the notional, plus fixed gas. */
export function oneWaySwapCostUsd(sizeUsd: number, m: CostModel = DEFAULT_COST_MODEL): number {
  if (!Number.isFinite(sizeUsd) || sizeUsd <= 0) return 0;
  const proportional = sizeUsd * ((m.swapFeeBps + m.estSlippageBps) / 10_000);
  return proportional + m.fixedGasUsd;
}

/** A full position (enter + exit) = two swaps. This is what a realized trade costs. */
export function roundTripCostUsd(sizeUsd: number, m: CostModel = DEFAULT_COST_MODEL): number {
  return 2 * oneWaySwapCostUsd(sizeUsd, m);
}

/** The price move a position must clear just to break even on a round trip, in %.
 *  Surfaced (not gated) — informs low-churn sizing and the backtest report. */
export function breakEvenReturnPct(sizeUsd: number, m: CostModel = DEFAULT_COST_MODEL): number {
  if (!Number.isFinite(sizeUsd) || sizeUsd <= 0) return 0;
  return (roundTripCostUsd(sizeUsd, m) / sizeUsd) * 100;
}

/** Resolve the cost model from env (recalibration without code changes), falling
 *  back to the conservative defaults. `c` is accepted for forward-compat but the
 *  model intentionally stays out of the committed constitution. */
export function costModelFromEnv(env: NodeJS.ProcessEnv = process.env, _c?: Constitution): CostModel {
  const num = (name: string, fallback: number): number => {
    const v = env[name];
    if (v === undefined || v === "") return fallback;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    swapFeeBps: num("COST_SWAP_FEE_BPS", DEFAULT_COST_MODEL.swapFeeBps),
    estSlippageBps: num("COST_EST_SLIPPAGE_BPS", DEFAULT_COST_MODEL.estSlippageBps),
    fixedGasUsd: num("COST_FIXED_GAS_USD", DEFAULT_COST_MODEL.fixedGasUsd),
  };
}
