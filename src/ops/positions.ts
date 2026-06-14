import { existsSync, readFileSync } from "node:fs";
import { atomicWriteJson, statePath } from "../util/io.js";
import type { Direction, Regime } from "../types.js";

// Open-decision tracking for the learning loop. A trade's quality can only be
// judged AFTER a holding horizon, so we record each decision and evaluate it on
// a later cycle. This is a LEARNING record (does the decision get graded), kept
// separate from the on-chain holding (which restart-state reads from chain).
// Persisted so evaluations survive restarts; works in dry-run too.

export interface OpenPosition {
  id: string; // ledger ts of the entry
  asset: string;
  direction: Direction;
  entryPrice: number;
  sizeUsd: number;
  regime: Regime; // the proposal's regime — which weight this trade updates
  entryRegime: Regime; // detector's regime AT ENTRY — for measuring persistence
  thesis: string;
  openedAt: number; // epoch ms
}

const PATH = statePath("positions.json");

export function loadPositions(): OpenPosition[] {
  if (!existsSync(PATH)) return [];
  try {
    return JSON.parse(readFileSync(PATH, "utf8")) as OpenPosition[];
  } catch {
    return [];
  }
}

export function savePositions(positions: OpenPosition[]): void {
  atomicWriteJson(PATH, positions);
}

/** Pure: evaluate a decision at the resolution horizon. PnL from the price move
 *  (direction-aware); thesisHeld = the regime PERSISTED (detector now == detector
 *  at entry) — measured consistently, distinct from PnL, so self-grading can tell
 *  skill (regime held + made money) from luck (made money but regime flipped). */
export function computeOutcome(
  pos: OpenPosition,
  currentPrice: number,
  currentRegime: Regime,
): { pnlUsd: number; thesisHeld: boolean } {
  const ret = pos.entryPrice > 0 ? (currentPrice - pos.entryPrice) / pos.entryPrice : 0;
  const sign = pos.direction === "buy" ? 1 : -1;
  return { pnlUsd: pos.sizeUsd * ret * sign, thesisHeld: currentRegime === pos.entryRegime };
}
