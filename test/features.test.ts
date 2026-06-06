import { describe, expect, it } from "vitest";
import { fgBucket, fundingSign, rsiZone, summarize } from "../src/signals/features.js";
import type { SignalBundle } from "../src/types.js";

describe("signal features", () => {
  it("buckets funding sign with a flat dead-zone", () => {
    expect(fundingSign(0.02)).toBe("positive");
    expect(fundingSign(-0.02)).toBe("negative");
    expect(fundingSign(0.0001)).toBe("flat");
    expect(fundingSign(undefined)).toBe("flat");
  });

  it("buckets Fear & Greed", () => {
    expect(fgBucket(10)).toBe("extreme_fear");
    expect(fgBucket(40)).toBe("fear");
    expect(fgBucket(50)).toBe("neutral");
    expect(fgBucket(65)).toBe("greed");
    expect(fgBucket(90)).toBe("extreme_greed");
  });

  it("buckets RSI zones", () => {
    expect(rsiZone(20)).toBe("oversold");
    expect(rsiZone(50)).toBe("neutral");
    expect(rsiZone(80)).toBe("overbought");
  });

  it("summarizes a bundle into named features", () => {
    const b: SignalBundle = {
      timestamp: "2026-06-22T00:00:00.000Z",
      asset: "CAKE",
      cmc: { fundingRate: 0.03, fearGreed: 80, rsi: 75 },
      chain: { isHoneypot: false },
    };
    expect(summarize(b)).toEqual({
      funding: "positive",
      sentiment: "extreme_greed",
      rsi: "overbought",
      honeypot: false,
    });
  });
});
