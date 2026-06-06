import { describe, expect, it } from "vitest";
import { detectRegime } from "../src/regime/index.js";
import type { SignalBundle } from "../src/types.js";

const bundle = (cmc: SignalBundle["cmc"]): SignalBundle => ({
  timestamp: "2026-06-22T00:00:00.000Z",
  asset: "CAKE",
  cmc,
  chain: {},
});

describe("regime detector", () => {
  it("flags risk-off on extreme fear", () => {
    expect(detectRegime(bundle({ fearGreed: 18 }))).toBe("risk_off");
  });

  it("flags risk-off on sharply negative funding", () => {
    expect(detectRegime(bundle({ fearGreed: 60, fundingRate: -0.1 }))).toBe("risk_off");
  });

  it("flags trending on greed + positive funding + positive momentum", () => {
    expect(detectRegime(bundle({ fearGreed: 65, fundingRate: 0.02, macd: 1.2 }))).toBe("trending");
  });

  it("defaults to chopping in mixed conditions", () => {
    expect(detectRegime(bundle({ fearGreed: 50, fundingRate: 0.0, macd: -0.1 }))).toBe("chopping");
  });

  it("defaults to chopping with no signals (neutral)", () => {
    expect(detectRegime(bundle({}))).toBe("chopping");
  });
});
