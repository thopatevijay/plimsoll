import { describe, expect, it } from "vitest";
import { parseProposal, propose, validateProposal } from "../src/brain/index.js";
import type { SignalBundle } from "../src/types.js";

describe("brain proposal parsing", () => {
  const valid = {
    regime: "trending",
    asset: "CAKE",
    direction: "buy",
    conviction: 0.8,
    thesis: "funding flipped positive while price held support",
  };

  it("accepts a well-formed proposal", () => {
    const p = validateProposal(valid);
    expect(p.asset).toBe("CAKE");
    expect(p.direction).toBe("buy");
  });

  it("clamps conviction into [0,1]", () => {
    expect(validateProposal({ ...valid, conviction: 1.7 }).conviction).toBe(1);
    expect(validateProposal({ ...valid, conviction: -0.3 }).conviction).toBe(0);
  });

  it("rejects an invalid regime/direction", () => {
    expect(() => validateProposal({ ...valid, regime: "moon" })).toThrow();
    expect(() => validateProposal({ ...valid, direction: "yolo" })).toThrow();
  });

  it("degrades malformed model output to a safe hold (never throws)", () => {
    const p = parseProposal("not json at all", "ETH");
    expect(p.direction).toBe("hold");
    expect(p.asset).toBe("ETH");
    expect(p.thesis).toMatch(/parse-failure/);
  });

  it("parses valid JSON text from the model", () => {
    const p = parseProposal(JSON.stringify(valid), "ETH");
    expect(p.direction).toBe("buy");
    expect(p.asset).toBe("CAKE");
  });

  it("keyless stub holds and reports the deterministically-detected regime", async () => {
    const bundle: SignalBundle = {
      timestamp: "2026-06-22T00:00:00.000Z",
      asset: "CAKE",
      cmc: { fearGreed: 12 }, // extreme fear → risk_off
      chain: {},
    };
    const p = await propose(bundle); // no OPENAI_API_KEY in test env → stub path
    expect(p.direction).toBe("hold");
    expect(p.regime).toBe("risk_off");
  });
});
