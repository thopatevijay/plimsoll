import { describe, expect, it } from "vitest";
import { loadConstitution } from "../src/config.js";

describe("constitution", () => {
  it("loads with the eligible-token allowlist populated", () => {
    const c = loadConstitution();
    expect(c.allowlist.symbols).toContain("CAKE");
    expect(c.allowlist.symbols).toContain("ETH");
    expect(c.allowlist.symbols.length).toBeGreaterThan(100);
  });

  it("keeps the kill-switch strictly below the DQ threshold", () => {
    const c = loadConstitution();
    expect(c.risk.hardDrawdownPct).toBeLessThan(c.risk.dqDrawdownPct);
  });

  it("allocates core + sleeve to 100%", () => {
    const c = loadConstitution();
    expect(c.allocation.survivalCorePct + c.allocation.activeSleevePct).toBe(100);
  });
});
