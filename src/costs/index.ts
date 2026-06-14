import type { Constitution } from "../types.js";

// SIMULATED TRANSACTION-COST MODEL.
//
// TWO costs exist and they are NOT the same:
//   1. The REAL live-execution cost the wallet pays per round-trip swap through the
//      TWAK interface. MEASURED at ~1.4% round-trip (pool spread + provider fee +
//      slippage; BSC gas adds only ~0.01–0.3%) across 12 quote samples on ETH/USDT,
//      flat from 0.1–10 ETH (community measurement, BNB Hack TG, 2026-06-14).
//   2. The SCORING simulated cost the judges apply for ranking — NOT yet published.
//      Stefano (organizer): "scoring uses simulated transaction costs, not live TWAK
//      quotes. Don't calibrate your break-even to the ~1.4% you measured until we
//      confirm the cost model." So we do NOT hard-gate on break-even (see 2.4).
//
// This model lives OUTSIDE the on-chain constitution (it is a recalibration estimate,
// not a committed risk rule — so the constitution hash is never disturbed by tuning
// it) and is fully env-tunable. Defaults are grounded in the measured live cost so
// the backtest honestly reflects what real capital will lose during the live week;
// override via env to swap in the official scoring model once organizers publish it.
//   - swapFeeBps 50     TWAK provider fee + AMM pool spread (the dominant cost).
//   - estSlippageBps 20 effective slippage; we gate liquidity >= $50k and cap max
//                       slippage at 100 bps. 50+20 = 70 bps/leg → ~1.4% round-trip.
//   - fixedGasUsd 0.20  ~BSC gas per swap (the measured 0.01–0.3%); fixed-$, so it
//                       bites small trades hardest.
export interface CostModel {
  swapFeeBps: number;
  estSlippageBps: number;
  fixedGasUsd: number;
}

export const DEFAULT_COST_MODEL: CostModel = {
  swapFeeBps: 50,
  estSlippageBps: 20,
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
