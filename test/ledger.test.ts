import { describe, expect, it } from "vitest";
import { selfGrade } from "../src/ledger/index.js";

describe("selfGrade", () => {
  it("rewards a win the thesis predicted most", () => {
    expect(selfGrade({ pnlUsd: 50, thesisHeld: true })).toBe(1);
  });

  it("gives only partial credit for a lucky win (thesis broke)", () => {
    expect(selfGrade({ pnlUsd: 50, thesisHeld: false })).toBe(0.3);
  });

  it("penalizes a wrong-and-thesis-broke trade hardest", () => {
    expect(selfGrade({ pnlUsd: -50, thesisHeld: false })).toBe(-1);
  });

  it("softly penalizes a loss whose thesis still held (bad luck)", () => {
    expect(selfGrade({ pnlUsd: -50, thesisHeld: true })).toBe(-0.3);
  });

  it("is neutral on a scratch", () => {
    expect(selfGrade({ pnlUsd: 0, thesisHeld: true })).toBe(0);
  });
});
