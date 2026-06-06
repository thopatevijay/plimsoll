import { describe, expect, it } from "vitest";
import { ruleProposer } from "../src/brain/rules.js";
import type { SignalBundle } from "../src/types.js";

const bundle = (cmc: SignalBundle["cmc"], chain: SignalBundle["chain"] = {}): SignalBundle => ({
  timestamp: "2026-06-22T00:00:00.000Z",
  asset: "CAKE",
  cmc,
  chain,
});

describe("rule-based proposer", () => {
  it("buys a confirmed trending setup", () => {
    const p = ruleProposer(bundle({ fearGreed: 65, fundingRate: 0.02, macd: 1, rsi: 55 }));
    expect(p.direction).toBe("buy");
    expect(p.regime).toBe("trending");
    expect(p.conviction).toBeGreaterThan(0);
  });

  it("holds in risk-off", () => {
    expect(ruleProposer(bundle({ fearGreed: 15 })).direction).toBe("hold");
  });

  it("never buys a flagged honeypot", () => {
    const p = ruleProposer(bundle({ fearGreed: 65, fundingRate: 0.02, macd: 1 }, { isHoneypot: true }));
    expect(p.direction).toBe("hold");
    expect(p.thesis).toMatch(/honeypot/);
  });

  it("stands aside when overbought even in a trend", () => {
    expect(ruleProposer(bundle({ fearGreed: 65, fundingRate: 0.02, macd: 1, rsi: 80 })).direction).toBe("hold");
  });

  it("stands aside in chop", () => {
    expect(ruleProposer(bundle({ fearGreed: 50, fundingRate: 0, macd: 0 })).direction).toBe("hold");
  });
});
