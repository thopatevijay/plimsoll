import { describe, expect, it } from "vitest";
import { parseHoneypot, MAX_SELL_TAX_PCT } from "../src/signals/honeypot.js";

// parseHoneypot is the pure interpreter of a honeypot.is v2 response. The live
// fetch is exercised separately; here we pin the verdict logic incl. fail-open.

describe("parseHoneypot", () => {
  it("treats a positive honeypot verdict as unsafe", () => {
    const r = parseHoneypot({ simulationSuccess: true, honeypotResult: { isHoneypot: true }, simulationResult: { buyTax: 0, sellTax: 0 } });
    expect(r.checked).toBe(true);
    expect(r.isHoneypot).toBe(true);
  });

  it("treats a successful clean simulation as safe (CAKE-like)", () => {
    const r = parseHoneypot({ simulationSuccess: true, honeypotResult: { isHoneypot: false }, simulationResult: { buyTax: 0, sellTax: 0 } });
    expect(r.checked).toBe(true);
    expect(r.isHoneypot).toBe(false);
    expect(r.sellTaxPct).toBe(0);
  });

  it("flags a punitive sell tax as a honeypot even if not technically un-sellable", () => {
    const r = parseHoneypot({ simulationSuccess: true, honeypotResult: { isHoneypot: false }, simulationResult: { buyTax: 1, sellTax: MAX_SELL_TAX_PCT + 5 } });
    expect(r.isHoneypot).toBe(true);
    expect(r.reason).toMatch(/sell tax/);
  });

  it("allows a tolerable sell tax", () => {
    const r = parseHoneypot({ simulationSuccess: true, honeypotResult: { isHoneypot: false }, simulationResult: { buyTax: 1, sellTax: 5 } });
    expect(r.isHoneypot).toBe(false);
  });

  it("fails open (checked:false) when the simulation did not succeed", () => {
    const r = parseHoneypot({ simulationSuccess: false, honeypotResult: {} });
    expect(r.checked).toBe(false);
    expect(r.isHoneypot).toBe(false);
  });

  it("fails open on a malformed / empty response", () => {
    expect(parseHoneypot(null).checked).toBe(false);
    expect(parseHoneypot(undefined).checked).toBe(false);
    expect(parseHoneypot({}).checked).toBe(false);
  });

  it("trusts a positive honeypot verdict even if the sim flag is shaky", () => {
    const r = parseHoneypot({ simulationSuccess: false, honeypotResult: { isHoneypot: true } });
    expect(r.isHoneypot).toBe(true);
    expect(r.checked).toBe(true);
  });
});
