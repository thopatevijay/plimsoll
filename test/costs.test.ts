import { describe, expect, it } from "vitest";
import {
  DEFAULT_COST_MODEL,
  breakEvenReturnPct,
  costModelFromEnv,
  oneWaySwapCostUsd,
  roundTripCostUsd,
} from "../src/costs/index.js";

describe("simulated tx-cost model", () => {
  it("one-way cost = proportional fee+slippage + fixed gas", () => {
    // $1000 notional @ (50+20)=70 bps = $7.00 + $0.20 gas = $7.20
    expect(oneWaySwapCostUsd(1000)).toBeCloseTo(7.2, 6);
  });

  it("round-trip is exactly two legs (enter + exit)", () => {
    expect(roundTripCostUsd(1000)).toBeCloseTo(2 * oneWaySwapCostUsd(1000), 6);
    expect(roundTripCostUsd(1000)).toBeCloseTo(14.4, 6);
  });

  it("fixed gas dominates on tiny trades (hurts small notionals most)", () => {
    // $5 trade: 70 bps = $0.035 proportional, but $0.20 gas → break-even ~9.4%
    expect(breakEvenReturnPct(5)).toBeGreaterThan(8);
  });

  it("matches the measured ~1.4% round-trip floor as size grows", () => {
    // Large trade → gas negligible → ~2*70bps = 1.4% round-trip floor
    // (community-measured TWAK round-trip on ETH/USDT, BNB Hack TG 2026-06-14).
    expect(breakEvenReturnPct(1_000_000)).toBeCloseTo(1.4, 1);
  });

  it("guards non-finite / non-positive sizes", () => {
    expect(oneWaySwapCostUsd(0)).toBe(0);
    expect(oneWaySwapCostUsd(-100)).toBe(0);
    expect(oneWaySwapCostUsd(Number.NaN)).toBe(0);
    expect(breakEvenReturnPct(0)).toBe(0);
  });

  it("reads overrides from env, ignoring invalid values", () => {
    const m = costModelFromEnv({
      COST_SWAP_FEE_BPS: "30",
      COST_EST_SLIPPAGE_BPS: "",
      COST_FIXED_GAS_USD: "-1",
    });
    expect(m.swapFeeBps).toBe(30);
    expect(m.estSlippageBps).toBe(DEFAULT_COST_MODEL.estSlippageBps); // empty → default
    expect(m.fixedGasUsd).toBe(DEFAULT_COST_MODEL.fixedGasUsd); // negative → default
  });
});
