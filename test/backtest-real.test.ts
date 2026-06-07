import { describe, expect, it } from "vitest";
import { buildRealSteps, buyHoldReturnPct, proxyFearGreed } from "../src/backtest/binance.js";

// Pure-function tests for the real-data backtest driver (no network).

describe("proxyFearGreed", () => {
  const flat = Array.from({ length: 30 }, () => 100);
  it("returns ~50 on flat momentum", () => {
    expect(proxyFearGreed(flat, 20)).toBe(50);
  });
  it("greed on strong up-momentum, fear on strong down-momentum", () => {
    const closes = [...flat];
    closes[29] = 130; // +30% vs closes[15]=100 over 14d
    expect(proxyFearGreed(closes, 29)).toBeGreaterThan(55);
    const down = [...flat];
    down[29] = 75; // -25% over 14d
    expect(proxyFearGreed(down, 29)).toBeLessThan(25);
  });
  it("clamps to [0,100] and defaults to 50 with no history", () => {
    expect(proxyFearGreed([100], 0)).toBe(50);
    const crash = Array.from({ length: 30 }, (_, i) => 1000 - i * 30);
    const v = proxyFearGreed(crash, 29);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(100);
  });
});

describe("buildRealSteps", () => {
  // A long enough series to clear the MACD warmup (35) with room for next-day returns.
  const rising = Array.from({ length: 80 }, (_, i) => 100 * 1.01 ** i); // steady uptrend

  it("produces steps with real next-day returns and a thesis flag", () => {
    const steps = buildRealSteps(rising, "TEST");
    expect(steps.length).toBeGreaterThan(30);
    for (const s of steps) {
      expect(typeof s.returnPctNext).toBe("number");
      expect(typeof s.thesisHeld).toBe("boolean");
      expect(s.bundle.cmc.rsi).toBeGreaterThan(0); // RSI computed from closes
    }
    // A steady +1%/day uptrend → every next-day return ~ +1%.
    expect(steps[0]!.returnPctNext).toBeCloseTo(0.01, 4);
  });

  it("returns [] when the series is too short for warmup", () => {
    expect(buildRealSteps([100, 101, 102], "TEST")).toEqual([]);
  });

  it("buyHoldReturnPct is positive for an uptrend", () => {
    expect(buyHoldReturnPct(rising)).toBeGreaterThan(0);
  });
});
