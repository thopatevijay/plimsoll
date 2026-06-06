import { describe, expect, it } from "vitest";
import {
  applyFill,
  drawdownPct,
  emptyPortfolio,
  markEquity,
  startNewDay,
} from "../src/portfolio/index.js";

describe("portfolio", () => {
  it("starts flat with equity = peak and zero drawdown", () => {
    const p = emptyPortfolio(1000);
    expect(p.equityUsd).toBe(1000);
    expect(p.peakEquityUsd).toBe(1000);
    expect(drawdownPct(p)).toBe(0);
  });

  it("tracks drawdown from the running peak", () => {
    let p = emptyPortfolio(1000);
    p = markEquity(p, 1200); // new peak
    p = markEquity(p, 900); // 25% off the 1200 peak
    expect(drawdownPct(p)).toBeCloseTo(25);
  });

  it("counts trades and accumulates daily volume on fills", () => {
    let p = emptyPortfolio(1000);
    p = applyFill(p, { txHash: "0x", filledAsset: "CAKE", filledUsd: 100 });
    p = applyFill(p, { txHash: "0x", filledAsset: "ETH", filledUsd: 50 });
    expect(p.tradesToday).toBe(2);
    expect(p.tradeVolumeTodayUsd).toBe(150);
    expect(p.positions.CAKE).toBe(100);
  });

  it("resets the daily counters on a new day", () => {
    let p = emptyPortfolio(1000);
    p = applyFill(p, { txHash: "0x", filledAsset: "CAKE", filledUsd: 100 });
    p = startNewDay(p);
    expect(p.tradesToday).toBe(0);
    expect(p.tradeVolumeTodayUsd).toBe(0);
    expect(p.positions.CAKE).toBe(100); // positions persist across days
  });
});
