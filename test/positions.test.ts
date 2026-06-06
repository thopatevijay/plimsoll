import { describe, expect, it } from "vitest";
import { computeOutcome, type OpenPosition } from "../src/ops/positions.js";

const pos = (over: Partial<OpenPosition> = {}): OpenPosition => ({
  id: "1",
  asset: "CAKE",
  direction: "buy",
  entryPrice: 2.0,
  sizeUsd: 100,
  regime: "trending",
  entryRegime: "trending",
  thesis: "t",
  openedAt: 0,
  ...over,
});

describe("computeOutcome", () => {
  it("profits a buy when price rises; thesis holds if regime persists", () => {
    const o = computeOutcome(pos(), 2.2, "trending"); // +10%
    expect(o.pnlUsd).toBeCloseTo(10);
    expect(o.thesisHeld).toBe(true);
  });

  it("loses a buy when price falls; thesis breaks if regime flipped", () => {
    const o = computeOutcome(pos(), 1.8, "risk_off"); // -10%, regime changed
    expect(o.pnlUsd).toBeCloseTo(-10);
    expect(o.thesisHeld).toBe(false);
  });

  it("profits a sell when price falls (direction-aware)", () => {
    const o = computeOutcome(pos({ direction: "sell" }), 1.8, "trending"); // -10% → short gain
    expect(o.pnlUsd).toBeCloseTo(10);
  });

  it("separates luck from skill: win but regime flipped → thesis broke", () => {
    const o = computeOutcome(pos(), 2.2, "chopping"); // made money, but predicted regime gone
    expect(o.pnlUsd).toBeGreaterThan(0);
    expect(o.thesisHeld).toBe(false);
  });
});
