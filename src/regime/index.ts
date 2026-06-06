import type { Regime, SignalBundle } from "../types.js";

// Deterministic regime classifier. The LLM brain also proposes a regime, but a
// pure rule-based detector gives us (a) a feature to feed the prompt, (b) a
// cross-check on the model, and (c) the gate that flattens the active sleeve in
// risk-off conditions. Keeping it deterministic means it's testable and can't
// hallucinate "trending" into a crash.
//
// NOTE: funding-rate scale (fraction vs %) is provider-dependent — thresholds
// here are provisional; confirm against live CMC derivatives data in the spike.

const EXTREME_FEAR = 25;
const GREED = 55;
const FUNDING_NEG = -0.05; // sharply negative funding = shorts paying = risk-off tilt

export function detectRegime(b: SignalBundle): Regime {
  const fearGreed = b.cmc.fearGreed ?? 50;
  const funding = b.cmc.fundingRate ?? 0;
  const macd = b.cmc.macd ?? 0;

  // Extreme fear or sharply negative funding → risk-off (sleeve goes flat).
  if (fearGreed <= EXTREME_FEAR || funding <= FUNDING_NEG) return "risk_off";

  // Greed + positive funding + positive momentum → trending (ride it).
  if (fearGreed >= GREED && funding >= 0 && macd > 0) return "trending";

  // Everything else → chop (sleeve stays cautious; core keeps qualifying).
  return "chopping";
}
