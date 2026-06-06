import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Proposal, Regime } from "../types.js";

// THE LEARNING LOOP (the differentiator). The brain proposes with a conviction;
// these weights scale that conviction by how well each market regime has
// actually worked for us lately. After a trade resolves, the ledger's self-grade
// nudges the relevant weight up or down — so the agent visibly gets more cautious
// in regimes where it's been wrong and leans in where it's been right.
//
// Pure + bounded, so it's testable and can't run away.

export const REGIMES: Regime[] = ["trending", "chopping", "risk_off"];

const LEARNING_RATE = 0.1;
const MIN_WEIGHT = 0.5; // never fully mute a regime
const MAX_WEIGHT = 1.5; // never let one regime dominate

export interface ConfidenceWeights {
  byRegime: Record<Regime, number>;
}

export function initialWeights(): ConfidenceWeights {
  return { byRegime: { trending: 1, chopping: 1, risk_off: 1 } };
}

export function getRegimeWeight(w: ConfidenceWeights, regime: Regime): number {
  return w.byRegime[regime];
}

/** A self-grade in [-1,1] nudges that regime's weight, bounded. Returns new state. */
export function updateRegimeWeight(
  w: ConfidenceWeights,
  regime: Regime,
  grade: number,
): ConfidenceWeights {
  const next = clamp(w.byRegime[regime] + LEARNING_RATE * clamp(grade, -1, 1), MIN_WEIGHT, MAX_WEIGHT);
  return { byRegime: { ...w.byRegime, [regime]: next } };
}

/** Scale a proposal's conviction by the learned weight for its regime. This is
 *  how past outcomes flow back into the next decision. */
export function applyWeights(p: Proposal, w: ConfidenceWeights): Proposal {
  const scaled = clamp(p.conviction * getRegimeWeight(w, p.regime), 0, 1);
  return { ...p, conviction: scaled };
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

// Persistence — weights survive restarts so learning compounds across the week.
const WEIGHTS_PATH = "weights.json";

export function loadWeights(): ConfidenceWeights {
  if (!existsSync(WEIGHTS_PATH)) return initialWeights();
  try {
    return JSON.parse(readFileSync(WEIGHTS_PATH, "utf8")) as ConfidenceWeights;
  } catch {
    return initialWeights(); // corrupt file → start neutral, never crash
  }
}

export function saveWeights(w: ConfidenceWeights): void {
  writeFileSync(WEIGHTS_PATH, JSON.stringify(w, null, 2));
}
