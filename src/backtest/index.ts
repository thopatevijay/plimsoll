import { ruleProposer } from "../brain/rules.js";
import { DEFAULT_COST_MODEL, oneWaySwapCostUsd, type CostModel } from "../costs/index.js";
import { evaluate } from "../kernel/index.js";
import { applyWeights, initialWeights, learnFromOutcome } from "../learning/index.js";
import type { ConfidenceWeights } from "../learning/index.js";
import { drawdownPct, emptyPortfolio, markEquity, startNewDay } from "../portfolio/index.js";
import type { Constitution, Regime, SignalBundle } from "../types.js";

// Pure replay of the FULL decision loop — rule proposer → learned weights → risk
// kernel → simulated fill → realized P&L → learning — over a series of daily steps.
// No network, deterministic. The basis for the Track-2 backtestable-strategy
// evidence and a keyless end-to-end proof that the learning loop adapts.
//
// HOLD-THROUGH-TREND MODEL: PLIMSOLL is a low-churn position trader, not a daily
// rebalancer. So an episode = ENTER on a confirmed trend (one swap), HOLD while the
// trend persists (accruing the daily price move, zero cost), and EXIT when the
// proposer flips to a risk-off sell or the window ends (one swap). Transaction cost
// is therefore one ROUND-TRIP per episode (entry leg + exit leg), NOT one per day —
// charging per-day would model a strategy we don't run and triple-count fees.

export interface BacktestStep {
  bundle: SignalBundle;
  thesisHeld: boolean;
  /** Flat realized $ result if traded (synthetic/legacy path), accrued per held day. */
  pnlUsd?: number;
  /** This period's return as a fraction (real path): held-day PnL = positionUsd × returnPctNext. */
  returnPctNext?: number;
}

export interface BacktestResult {
  startEquityUsd: number;
  finalEquityUsd: number;
  peakEquityUsd: number;
  maxDrawdownPct: number;
  /** Completed round-trip episodes (enter→exit), not per-day fills. */
  trades: number;
  wins: number;
  /** Total simulated transaction cost charged (one round-trip per episode). */
  totalCostUsd: number;
  weights: ConfidenceWeights;
}

export function runBacktest(
  steps: BacktestStep[],
  c: Constitution,
  startEquityUsd: number,
  costModel: CostModel = DEFAULT_COST_MODEL,
): BacktestResult {
  let portfolio = emptyPortfolio(startEquityUsd);
  let weights = initialWeights();
  let trades = 0;
  let wins = 0;
  let totalCostUsd = 0;
  let maxDrawdownPct = 0;

  // Open-episode state.
  let holding = false;
  let positionUsd = 0;
  let entryRegime: Regime = "trending";
  let episodeGrossPnl = 0; // sum of daily P&L while held
  let episodeEntryCost = 0;

  /** Close the open episode: charge the exit leg, count it, and learn once from the
   *  net round-trip result. exitByRiskOff=false means the window ended mid-trend. */
  const closeEpisode = (exitByRiskOff: boolean): void => {
    const exitCost = oneWaySwapCostUsd(positionUsd, costModel);
    totalCostUsd += exitCost;
    portfolio = markEquity(portfolio, portfolio.equityUsd - exitCost);
    const episodeNet = episodeGrossPnl - episodeEntryCost - exitCost;
    trades++;
    if (episodeNet > 0) wins++;
    // Thesis held if we rode the trend to the window edge; broke if risk-off forced us out.
    weights = learnFromOutcome(weights, entryRegime, { pnlUsd: episodeNet, thesisHeld: !exitByRiskOff }).weights;
    holding = false;
    positionUsd = 0;
    episodeGrossPnl = 0;
    episodeEntryCost = 0;
  };

  for (const step of steps) {
    portfolio = startNewDay(portfolio); // one step = one trading day
    // Reflect the open position so the kernel can size a sell (exit) against it.
    portfolio = { ...portfolio, positions: holding ? { [step.bundle.asset]: positionUsd } : {} };

    const proposal = applyWeights(ruleProposer(step.bundle), weights);
    const decision = evaluate(proposal, portfolio, c, { regime: proposal.regime });

    if (decision.ok && decision.order.direction === "buy" && !holding) {
      // ENTER: pay the entry leg, open the position (no re-entry / averaging while held).
      const entryCost = oneWaySwapCostUsd(decision.order.sizeUsd, costModel);
      totalCostUsd += entryCost;
      episodeEntryCost = entryCost;
      positionUsd = decision.order.sizeUsd;
      entryRegime = proposal.regime;
      holding = true;
      episodeGrossPnl = 0;
      portfolio = markEquity(portfolio, portfolio.equityUsd - entryCost);
    } else if (decision.ok && decision.order.direction === "sell" && holding) {
      // EXIT: risk-off flattened the sleeve — close before accruing this day's move.
      closeEpisode(true);
    }

    // Accrue the day's price move on any still-open position (incl. the entry day).
    if (holding) {
      const dayPnl =
        step.returnPctNext !== undefined ? positionUsd * step.returnPctNext : (step.pnlUsd ?? 0);
      episodeGrossPnl += dayPnl;
      portfolio = markEquity(portfolio, portfolio.equityUsd + dayPnl);
    }

    maxDrawdownPct = Math.max(maxDrawdownPct, drawdownPct(portfolio));
  }

  // Window ended with a position open → mark it closed at the final price (mid-trend exit).
  if (holding) closeEpisode(false);

  return {
    startEquityUsd,
    finalEquityUsd: portfolio.equityUsd,
    peakEquityUsd: portfolio.peakEquityUsd,
    maxDrawdownPct,
    trades,
    wins,
    totalCostUsd,
    weights,
  };
}
