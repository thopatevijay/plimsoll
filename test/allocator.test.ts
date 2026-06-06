import { describe, expect, it } from "vitest";
import { allocate } from "../src/allocator/index.js";
import { loadConstitution } from "../src/config.js";

const c = loadConstitution();

describe("barbell allocator", () => {
  it("splits equity into core + sleeve by the constitution", () => {
    const a = allocate(1000, c, "trending");
    expect(a.coreUsd).toBeCloseTo(1000 * (c.allocation.survivalCorePct / 100));
    expect(a.sleeveUsd).toBeCloseTo(1000 * (c.allocation.activeSleevePct / 100));
  });

  it("keeps the sleeve active in trending and chopping", () => {
    expect(allocate(1000, c, "trending").sleeveActive).toBe(true);
    expect(allocate(1000, c, "chopping").sleeveActive).toBe(true);
  });

  it("flattens the sleeve in risk-off (core only)", () => {
    const a = allocate(1000, c, "risk_off");
    expect(a.sleeveActive).toBe(false);
    expect(a.sleeveUsd).toBe(0);
    expect(a.coreUsd).toBeGreaterThan(0);
  });
});
