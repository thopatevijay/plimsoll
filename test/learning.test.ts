import { describe, expect, it } from "vitest";
import {
  applyWeights,
  getRegimeWeight,
  initialWeights,
  learnFromOutcome,
  updateRegimeWeight,
} from "../src/learning/index.js";
import type { Proposal } from "../src/types.js";

const prop = (regime: Proposal["regime"], conviction: number): Proposal => ({
  regime, asset: "CAKE", direction: "buy", conviction, thesis: "t",
});

describe("learning weights", () => {
  it("starts neutral (all regimes weighted 1.0)", () => {
    const w = initialWeights();
    expect(getRegimeWeight(w, "trending")).toBe(1);
    expect(getRegimeWeight(w, "risk_off")).toBe(1);
  });

  it("raises a regime's weight after good outcomes, capped at 1.5", () => {
    let w = initialWeights();
    for (let i = 0; i < 20; i++) w = updateRegimeWeight(w, "trending", 1);
    expect(getRegimeWeight(w, "trending")).toBe(1.5);
  });

  it("lowers a regime's weight after bad outcomes, floored at 0.5", () => {
    let w = initialWeights();
    for (let i = 0; i < 20; i++) w = updateRegimeWeight(w, "chopping", -1);
    expect(getRegimeWeight(w, "chopping")).toBe(0.5);
  });

  it("only touches the graded regime", () => {
    const w = updateRegimeWeight(initialWeights(), "trending", 1);
    expect(getRegimeWeight(w, "trending")).toBeGreaterThan(1);
    expect(getRegimeWeight(w, "chopping")).toBe(1);
  });

  it("scales conviction by the learned regime weight (clamped to [0,1])", () => {
    let w = initialWeights();
    for (let i = 0; i < 20; i++) w = updateRegimeWeight(w, "risk_off", -1); // → 0.5
    const scaled = applyWeights(prop("risk_off", 0.8), w);
    expect(scaled.conviction).toBeCloseTo(0.4); // 0.8 * 0.5
  });
});

describe("learnFromOutcome (closing the loop)", () => {
  it("raises the regime weight on a thesis-predicted win", () => {
    const { weights, grade } = learnFromOutcome(initialWeights(), "trending", {
      pnlUsd: 30,
      thesisHeld: true,
    });
    expect(grade).toBe(1);
    expect(getRegimeWeight(weights, "trending")).toBeGreaterThan(1);
  });

  it("lowers the regime weight on a wrong, thesis-broke loss", () => {
    const { weights, grade } = learnFromOutcome(initialWeights(), "chopping", {
      pnlUsd: -30,
      thesisHeld: false,
    });
    expect(grade).toBe(-1);
    expect(getRegimeWeight(weights, "chopping")).toBeLessThan(1);
  });
});
