import { appendFileSync, existsSync, readFileSync } from "node:fs";
import type { LedgerEntry } from "../types.js";

// The DECISION LEDGER — append-only JSONL. The spine of the learning loop, the
// demo centerpiece (thought-stream), and the judges' strategy explanation.
// Phase 3 adds: outcome self-grading + per-regime/per-signal weight updates that
// feed back into the brain's next decision.

const LEDGER_PATH = "ledger.jsonl";

// Grade a resolved trade in [-1, 1]. This is what feeds the learning weights.
// We separate "did we make money" from "was the thesis right" so the agent
// learns from its *reasoning*, not just luck — a win on a broken thesis earns
// far less credit than a win the thesis predicted.
export function selfGrade(outcome: { pnlUsd: number; thesisHeld: boolean }): number {
  if (outcome.pnlUsd === 0) return 0;
  const win = outcome.pnlUsd > 0;
  if (win && outcome.thesisHeld) return 1; // right, and for the right reason
  if (win && !outcome.thesisHeld) return 0.3; // right, but lucky
  if (!win && outcome.thesisHeld) return -0.3; // reasonable thesis, bad luck
  return -1; // wrong, and the thesis broke
}

export function append(entry: LedgerEntry): void {
  appendFileSync(LEDGER_PATH, JSON.stringify(entry) + "\n");
}

export function readAll(): LedgerEntry[] {
  if (!existsSync(LEDGER_PATH)) return [];
  return readFileSync(LEDGER_PATH, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LedgerEntry);
}
