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

  it("fails closed on NaN / non-positive equity (does not let NaN defeat the kill-switch)", () => {
    const nan: PortfolioState = { ...healthy, equityUsd: Number.NaN };
    expect(evaluate(buy("CAKE"), nan, C).ok).toBe(false);
    const zero: PortfolioState = { ...healthy, equityUsd: 0 };
    expect(evaluate(buy("CAKE"), zero, C).ok).toBe(false);
  });

  it("rejects once the daily volume cap is reached", () => {
    // dailyMax 40% of $1000 = $400 already traded today
    const maxedOut: PortfolioState = { ...healthy, tradeVolumeTodayUsd: 400 };
    const d = evaluate(buy("CAKE"), maxedOut, C);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toMatch(/daily volume cap/);
  });

  it("clamps size to the remaining daily budget", () => {
    // $360 used of the $400 daily cap → only $40 left, below the $150 per-trade cap
    const nearCap: PortfolioState = { ...healthy, tradeVolumeTodayUsd: 360 };
    const d = evaluate(buy("CAKE", 1.0), nearCap, C);
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.order.sizeUsd).toBeCloseTo(40);
  });

  describe("pre-buy safety gates", () => {
    it("refuses to buy a flagged honeypot", () => {
      const d = evaluate(buy("CAKE"), healthy, C, { isHoneypot: true });
      expect(d.ok).toBe(false);
      if (!d.ok) expect(d.reason).toMatch(/honeypot/);
    });

    it("refuses to buy below the DEX liquidity floor", () => {
      const d = evaluate(buy("CAKE"), healthy, C, { liquidityUsd: 10_000 });
      expect(d.ok).toBe(false);
      if (!d.ok) expect(d.reason).toMatch(/liquidity/);
    });

    it("approves a buy with healthy liquidity and no honeypot flag", () => {
      const d = evaluate(buy("CAKE"), healthy, C, { isHoneypot: false, liquidityUsd: 1_000_000 });
      expect(d.ok).toBe(true);
    });

    it("does not block buys when safety is unverified (fail-open)", () => {
      expect(evaluate(buy("CAKE"), healthy, C, {}).ok).toBe(true);
    });

    it("lets a SELL through even when the token is a honeypot (you can always exit)", () => {
      const sell: Proposal = { ...buy("CAKE"), direction: "sell" };
      const d = evaluate(sell, healthy, C, { isHoneypot: true, liquidityUsd: 1 });
      expect(d.ok).toBe(true);
    });
  });
});
