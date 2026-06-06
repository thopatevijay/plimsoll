import { describe, expect, it } from "vitest";
import { ema, macd, rsi } from "../src/signals/indicators.js";

const range = (n: number, dir: 1 | -1 = 1): number[] =>
  Array.from({ length: n }, (_, i) => (dir === 1 ? i + 1 : n - i));

describe("indicators", () => {
  it("ema seeds with SMA and tracks the series", () => {
    const e = ema([1, 2, 3, 4, 5], 2);
    expect(e[0]).toBeCloseTo(1.5); // SMA of [1,2]
    expect(e[e.length - 1]).toBeCloseTo(4.5);
  });

  it("ema returns empty when given too little data", () => {
    expect(ema([1, 2], 5)).toEqual([]);
  });

  it("rsi is 100 for a monotonically rising series", () => {
    expect(rsi(range(20, 1))).toBe(100);
  });

  it("rsi is 0 for a monotonically falling series", () => {
    expect(rsi(range(20, -1))).toBe(0);
  });

  it("rsi is undefined with insufficient data", () => {
    expect(rsi([1, 2, 3])).toBeUndefined();
  });

  it("macd is positive on a sustained uptrend", () => {
    const m = macd(range(40, 1));
    expect(m).toBeDefined();
    expect(m!.macd).toBeGreaterThan(0);
  });

  it("macd is undefined with insufficient data", () => {
    expect(macd(range(10, 1))).toBeUndefined();
  });
});
