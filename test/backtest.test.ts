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

describe("backtest harness (hold-through-trend, keyless)", () => {
  it("a sustained trend is ONE episode (enter→hold→exit), not one trade per day", () => {
    const r = runBacktest(steps(5, trending, 20, true), c, 1000);
    expect(r.trades).toBe(1); // 5 trending days = one held episode
    expect(r.finalEquityUsd).toBeGreaterThan(1000);
    expect(getRegimeWeight(r.weights, "trending")).toBeGreaterThan(1);
  });

  it("tracks drawdown and lowers the trending weight on a losing episode", () => {
    const r = runBacktest(steps(5, trending, -20, false), c, 1000);
    expect(r.trades).toBe(1);
    expect(r.finalEquityUsd).toBeLessThan(1000);
    expect(r.maxDrawdownPct).toBeGreaterThan(0);
    expect(getRegimeWeight(r.weights, "trending")).toBeLessThan(1);
  });

  it("does not open a position in a sustained risk-off regime", () => {
    const r = runBacktest(steps(5, riskOff, 50, true), c, 1000);
    expect(r.trades).toBe(0); // proposer sells, but nothing is held → no episode
    expect(r.finalEquityUsd).toBe(1000);
    expect(r.maxDrawdownPct).toBe(0);
    expect(r.totalCostUsd).toBe(0);
  });

  it("charges exactly ONE round-trip per episode (cost amortizes over the hold)", () => {
    const r5 = runBacktest(steps(5, trending, 20, true), c, 1000);
    const r20 = runBacktest(steps(20, trending, 20, true), c, 1000);
    expect(r5.trades).toBe(1);
    expect(r20.trades).toBe(1);
    // A 20-day hold pays the SAME single round-trip as a 5-day hold (same entry size).
    expect(r20.totalCostUsd).toBeCloseTo(r5.totalCostUsd, 6);
    expect(r5.totalCostUsd).toBeGreaterThan(0);
  });

  it("exits (sells) when the regime flips to risk-off, then stays flat", () => {
    // Enter on 4 trending days, then risk-off forces an exit; remaining days stay flat.
    const scenario = [...steps(4, trending, 20, true), ...steps(3, riskOff, 0, false)];
    const r = runBacktest(scenario, c, 1000);
    expect(r.trades).toBe(1); // one completed round-trip, closed by the risk-off exit
    expect(r.finalEquityUsd).toBeGreaterThan(1000); // +80 gross over the hold, minus one round-trip
  });

  it("an episode that gains less than the round-trip cost nets negative", () => {
    // Enter, hold one day for a tiny +$1, then risk-off exit → gain < ~1.4% round-trip.
    const scenario = [...steps(1, trending, 1, true), ...steps(1, riskOff, 0, false)];
    const r = runBacktest(scenario, c, 1000);
    expect(r.trades).toBe(1);
    expect(r.totalCostUsd).toBeGreaterThan(1); // round-trip cost exceeds the $1 gain
    expect(r.finalEquityUsd).toBeLessThan(1000);
  });
});
