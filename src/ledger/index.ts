import { appendFileSync, existsSync, readFileSync } from "node:fs";
import type { LedgerEntry } from "../types.js";

// The DECISION LEDGER — append-only JSONL. The spine of the learning loop, the
// demo centerpiece (thought-stream), and the judges' strategy explanation.
// Phase 3 adds: outcome self-grading + per-regime/per-signal weight updates that
// feed back into the brain's next decision.

const LEDGER_PATH = "ledger.jsonl";

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
