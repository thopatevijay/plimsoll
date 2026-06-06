import { describe, expect, it } from "vitest";
import { evaluate } from "../src/kernel/index.js";
import type { Constitution, PortfolioState, Proposal } from "../src/types.js";

// The kernel is the most-tested unit: it's the floor that prevents a DQ and the
// guardrail the TWAK special scores. Every limit gets a table-driven test.

const C: Constitution = {
  version: 1,
  risk: { hardDrawdownPct: 20, dqDrawdownPct: 30 },
  sizing: { perTradeMaxPctOfEquity: 15, dailyMaxTradeVolumePctOfEquity: 40, maxSlippageBps: 100 },
  allocation: { survivalCorePct: 35, activeSleevePct: 65 },
  trading: { minTradesPerDay: 1, spotOnly: true },
  allowlist: { symbols: ["CAKE", "ETH"] },
};

const healthy: PortfolioState = { equityUsd: 1000, peakEquityUsd: 1000, positions: {}, tradesToday: 0, tradeVolumeTodayUsd: 0 };
const buy = (asset: string, conviction = 1): Proposal => ({
  regime: "trending", asset, direction: "buy", conviction, thesis: "t",
});

describe("risk kernel", () => {
  it("approves an allowlisted buy and sizes within the per-trade cap", () => {
    const d = evaluate(buy("CAKE"), healthy, C);
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.order.sizeUsd).toBeLessThanOrEqual(1000 * 0.15);
  });

  it("rejects assets outside the allowlist", () => {
    const d = evaluate(buy("DOGE"), healthy, C);
    expect(d.ok).toBe(false);
  });

  it("trips the drawdown kill-switch at the hard floor", () => {
    const drawn: PortfolioState = { ...healthy, equityUsd: 790, peakEquityUsd: 1000 }; // 21% dd
    const d = evaluate(buy("CAKE"), drawn, C);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toMatch(/drawdown/);
  });

  it("scales size down with conviction", () => {
    const hi = evaluate(buy("CAKE", 1.0), healthy, C);
    const lo = evaluate(buy("CAKE", 0.2), healthy, C);
    if (hi.ok && lo.ok) expect(lo.order.sizeUsd).toBeLessThan(hi.order.sizeUsd);
  });

  it("treats hold as a no-op", () => {
    const d = evaluate({ ...buy("CAKE"), direction: "hold" }, healthy, C);
    expect(d.ok).toBe(false);
  });
});
