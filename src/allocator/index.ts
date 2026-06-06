import type { Constitution, Regime } from "../types.js";

// Barbell allocation. The survival core bounds drawdown and carries the daily
// qualifier; the active sleeve takes regime-gated momentum shots. The sleeve
// only deploys when the regime supports it — in risk-off it goes flat and the
// core keeps the agent qualifying. This is how we stay in PnL contention without
// risking the drawdown DQ.

export interface Allocation {
  coreUsd: number;
  sleeveUsd: number;
  sleeveActive: boolean;
}

export function allocate(equityUsd: number, c: Constitution, regime: Regime): Allocation {
  const coreUsd = equityUsd * (c.allocation.survivalCorePct / 100);
  const sleeveBudget = equityUsd * (c.allocation.activeSleevePct / 100);
  const sleeveActive = regime !== "risk_off"; // flat in risk-off
  return { coreUsd, sleeveUsd: sleeveActive ? sleeveBudget : 0, sleeveActive };
}
