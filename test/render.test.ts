import { describe, expect, it } from "vitest";
import { renderEntry } from "../src/ledger/index.js";
import type { LedgerEntry, SignalBundle } from "../src/types.js";

const bundle: SignalBundle = {
  timestamp: "2026-06-22T09:30:00.000Z",
  asset: "CAKE",
  cmc: {},
  chain: {},
};

describe("thought-stream render", () => {
  it("renders an approved + executed + resolved trade narratively", () => {
    const entry: LedgerEntry = {
      ts: "2026-06-22T09:30:00.000Z",
      bundle,
      proposal: { regime: "trending", asset: "CAKE", direction: "buy", conviction: 0.8, thesis: "momentum + funding" },
      decision: { ok: true, order: { asset: "CAKE", direction: "buy", sizeUsd: 120, maxSlippageBps: 100 } },
      exec: { txHash: "0xabc", filledAsset: "CAKE", filledUsd: 120 },
      outcome: { pnlUsd: 15, thesisHeld: true },
      selfGrade: 1,
    };
    const out = renderEntry(entry);
    expect(out).toContain("TRENDING → buy CAKE");
    expect(out).toContain("thesis: momentum + funding");
    expect(out).toContain("approved");
    expect(out).toContain("0xabc");
    expect(out).toContain("+$15.00");
    expect(out).toContain("grade 1.00");
  });

  it("renders a blocked trade with the reason", () => {
    const entry: LedgerEntry = {
      ts: "2026-06-22T09:31:00.000Z",
      bundle,
      proposal: { regime: "risk_off", asset: "DOGE", direction: "buy", conviction: 0.3, thesis: "dip" },
      decision: { ok: false, reason: "asset DOGE not in allowlist" },
    };
    const out = renderEntry(entry);
    expect(out).toContain("blocked");
    expect(out).toContain("not in allowlist");
  });
});
