import { describe, expect, it } from "vitest";
import { planQualifier } from "../src/ops/qualifier.js";

const base = { tradesToday: 0, hourUtc: 22, usdcUsd: 40, usdtUsd: 0, sizeUsd: 2, hourThresholdUtc: 22 };

describe("daily-trade qualifier planner", () => {
  it("fires a USDC→USDT (buy) swap late in a no-trade day", () => {
    const p = planQualifier(base);
    expect(p).toEqual({ direction: "buy", sizeUsd: 2 });
  });

  it("skips when the strategy already traded today", () => {
    expect(planQualifier({ ...base, tradesToday: 1 })).toBeNull();
  });

  it("skips before the threshold hour (gives the strategy the day first)", () => {
    expect(planQualifier({ ...base, hourUtc: 21 })).toBeNull();
  });

  it("sources from USDT (sell) when we hold more USDT than USDC", () => {
    expect(planQualifier({ ...base, usdcUsd: 1, usdtUsd: 40 })).toEqual({ direction: "sell", sizeUsd: 2 });
  });

  it("skips when neither stable has enough to cover the qualifier size", () => {
    expect(planQualifier({ ...base, usdcUsd: 0.5, usdtUsd: 0.5 })).toBeNull();
  });

  it("fires past the threshold hour too (e.g. 23:00)", () => {
    expect(planQualifier({ ...base, hourUtc: 23 })).toEqual({ direction: "buy", sizeUsd: 2 });
  });
});
