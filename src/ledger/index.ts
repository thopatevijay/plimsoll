import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { statePath } from "../util/io.js";
import type { LedgerEntry } from "../types.js";

// The DECISION LEDGER — append-only JSONL. The spine of the learning loop, the
// demo centerpiece (thought-stream), and the judges' strategy explanation.
// Phase 3 adds: outcome self-grading + per-regime/per-signal weight updates that
// feed back into the brain's next decision.

const LEDGER_PATH = statePath("ledger.jsonl");

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
  const out: LedgerEntry[] = [];
  for (const line of readFileSync(LEDGER_PATH, "utf8").split("\n")) {
    if (!line) continue;
    try {
      out.push(JSON.parse(line) as LedgerEntry); // skip a truncated final line after a crash
    } catch {
      /* ignore corrupt line */
    }
  }
  return out;
}

// The "thought-stream" — renders a ledger entry as a readable narrative for the
// live demo. This is what makes the agent's reasoning watchable: signal → thesis
// → verdict → outcome, in plain language, instead of a raw JSON dump.
export function renderEntry(e: LedgerEntry): string {
  const t = e.ts.slice(11, 19); // HH:MM:SS
  const p = e.proposal;
  const lines = [
    `🧠 ${t}  ${p.regime.toUpperCase()} → ${p.direction} ${p.asset}  (conviction ${p.conviction.toFixed(2)})`,
    `   thesis: ${p.thesis}`,
  ];
  lines.push(
    e.decision.ok
      ? `   ✅ approved: ${e.decision.order.direction} $${e.decision.order.sizeUsd.toFixed(2)} ${e.decision.order.asset}`
      : `   🛡️ blocked: ${e.decision.reason}`,
  );
  if (e.exec) lines.push(`   ⛓️  tx: ${e.exec.txHash}`);
  if (e.outcome) {
    const sign = e.outcome.pnlUsd >= 0 ? "+" : "";
    lines.push(
      `   📈 outcome: ${sign}$${e.outcome.pnlUsd.toFixed(2)} · thesis ${e.outcome.thesisHeld ? "held" : "broke"}` +
        (e.selfGrade !== undefined ? ` · grade ${e.selfGrade.toFixed(2)}` : ""),
    );
  }
  return lines.join("\n");
}

export function renderStream(entries: LedgerEntry[]): string {
  return entries.map(renderEntry).join("\n\n");
}
