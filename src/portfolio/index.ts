import type { ExecResult, PortfolioState } from "../types.js";

// Portfolio state — the ground truth the kernel sizes against and the ledger
// grades outcomes from. Pure helpers (return new state) so they're trivially
// testable and safe to call from the loop. In the live week the equity figure
// is refreshed from chain on every boot (Phase 5), never trusted from memory.

export function emptyPortfolio(startEquityUsd: number): PortfolioState {
  return {
    equityUsd: startEquityUsd,
    peakEquityUsd: startEquityUsd,
    positions: {},
    tradesToday: 0,
    tradeVolumeTodayUsd: 0,
  };
}

/** Drawdown from the equity peak, as a percentage. The kernel's kill-switch and
 *  the DQ gate both read this — peak-to-trough is the metric that matters. */
export function drawdownPct(state: PortfolioState): number {
  // Fail closed: a non-finite or non-positive peak/equity (bad chain read, parse
  // error) reports MAX drawdown so every reader treats it as "halt", never "fine".
  if (!Number.isFinite(state.equityUsd) || !Number.isFinite(state.peakEquityUsd) || state.peakEquityUsd <= 0) {
    return 100;
  }
  return ((state.peakEquityUsd - state.equityUsd) / state.peakEquityUsd) * 100;
}

/** Record a fill: update the position notional and the daily trade counters.
 *  (Buy/sell direction handling is refined in Phase 4 when real fills arrive.) */
export function applyFill(state: PortfolioState, fill: ExecResult): PortfolioState {
  const positions = { ...state.positions };
  positions[fill.filledAsset] = (positions[fill.filledAsset] ?? 0) + fill.filledUsd;
  return {
    ...state,
    positions,
    tradesToday: state.tradesToday + 1,
    tradeVolumeTodayUsd: state.tradeVolumeTodayUsd + Math.abs(fill.filledUsd),
  };
}

/** Mark equity to market and advance the running peak. */
export function markEquity(state: PortfolioState, equityUsd: number): PortfolioState {
  return {
    ...state,
    equityUsd,
    peakEquityUsd: Math.max(state.peakEquityUsd, equityUsd),
  };
}

/** Roll to a new trading day — resets the counters the kernel's daily caps read. */
export function startNewDay(state: PortfolioState): PortfolioState {
  return { ...state, tradesToday: 0, tradeVolumeTodayUsd: 0 };
}
