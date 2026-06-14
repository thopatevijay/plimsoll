import { describe, expect, it } from "vitest";
import { runBacktest, type BacktestStep } from "../src/backtest/index.js";
import { loadConstitution } from "../src/config.js";
import { getRegimeWeight } from "../src/learning/index.js";
import type { SignalBundle } from "../src/types.js";

const c = loadConstitution();
const trending: SignalBundle = {
  timestamp: "2026-06-22T00:00:00.000Z",
  asset: "CAKE",
  cmc: { fearGreed: 65, fundingRate: 0.02, macd: 1, rsi: 55 },
  chain: {},
};
const riskOff: SignalBundle = { ...trending, cmc: { fearGreed: 12 } };

const steps = (n: number, bundle: SignalBundle, pnlUsd: number, thesisHeld: boolean): BacktestStep[] =>
  Array.from({ length: n }, () => ({ bundle, pnlUsd, thesisHeld }));

describe("backtest harness (full loop, keyless)", () => {
  it("trades winners, grows equity, and raises the trending weight", () => {
    const r = runBacktest(steps(5, trending, 20, true), c, 1000);
    expect(r.trades).toBe(5);
    expect(r.finalEquityUsd).toBeGreaterThan(1000);
    expect(getRegimeWeight(r.weights, "trending")).toBeGreaterThan(1);
  });

  it("tracks drawdown and lowers the trending weight on losing trades", () => {
    const r = runBacktest(steps(5, trending, -20, false), c, 1000);
    expect(r.trades).toBe(5);
    expect(r.finalEquityUsd).toBeLessThan(1000);
    expect(r.maxDrawdownPct).toBeGreaterThan(0);
    expect(getRegimeWeight(r.weights, "trending")).toBeLessThan(1);
  });

  it("does not trade in a sustained risk-off regime", () => {
    const r = runBacktest(steps(5, riskOff, 50, true), c, 1000);
    expect(r.trades).toBe(0);
    expect(r.finalEquityUsd).toBe(1000);
    expect(r.maxDrawdownPct).toBe(0);
    expect(r.totalCostUsd).toBe(0); // no trades → no cost
  });

  it("charges a simulated tx cost on every trade (net < gross)", () => {
    const r = runBacktest(steps(5, trending, 20, true), c, 1000);
    expect(r.totalCostUsd).toBeGreaterThan(0);
    // Net equity must be strictly below the cost-free gross (1000 + 5×20).
    expect(r.finalEquityUsd).toBeLessThan(1000 + 5 * 20);
    expect(r.finalEquityUsd).toBeCloseTo(1000 + 5 * 20 - r.totalCostUsd, 6);
  });

  it("a sub-cost edge loses money after fees (turns a thin winner negative)", () => {
    // Gross +$1/trade is below the per-trade round-trip cost → net erosion.
    const r = runBacktest(steps(10, trending, 1, true), c, 1000);
    expect(r.finalEquityUsd).toBeLessThan(1000);
  });
});
