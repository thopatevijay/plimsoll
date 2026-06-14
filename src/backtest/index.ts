import { ruleProposer } from "../brain/rules.js";
import { DEFAULT_COST_MODEL, roundTripCostUsd, type CostModel } from "../costs/index.js";
import { evaluate } from "../kernel/index.js";
import { applyWeights, initialWeights, learnFromOutcome } from "../learning/index.js";
import type { ConfidenceWeights } from "../learning/index.js";
import { applyFill, drawdownPct, emptyPortfolio, markEquity, startNewDay } from "../portfolio/index.js";
import type { Constitution, SignalBundle } from "../types.js";

// Pure replay of the FULL decision loop — rule proposer → learned weights →
// risk kernel → simulated fill → realized P&L → learning — over a series of
// daily steps. No network, deterministic. The basis for Phase-7 backtests, the
// Track-2 backtestable-strategy evidence, and a keyless end-to-end proof that
// the learning loop actually adapts.

export interface BacktestStep {
  bundle: SignalBundle;
  thesisHeld: boolean;
  /** Flat realized $ result if traded (synthetic/legacy path). */
  pnlUsd?: number;
  /** Next-period return as a fraction (real path): realized PnL = sizeUsd × returnPctNext.
   *  Size-aware so the curve actually compounds on real price moves. */
  returnPctNext?: number;
}

export interface BacktestResult {
  startEquityUsd: number;
  finalEquityUsd: number;
  peakEquityUsd: number;
  maxDrawdownPct: number;
  trades: number;
  wins: number;
  /** Total simulated transaction cost charged across all trades (round-trip). */
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

  for (const step of steps) {
    portfolio = startNewDay(portfolio); // one step = one trading day
    const proposal = applyWeights(ruleProposer(step.bundle), weights);
    const decision = evaluate(proposal, portfolio, c);

    if (decision.ok) {
      trades++;
      // Size-aware realized P&L when a real return series is supplied; else the
      // flat synthetic figure. "sell" is an exit (no new long PnL); the rule
      // proposer only emits buy/hold, so approved trades are buys.
      const sign = decision.order.direction === "buy" ? 1 : -1;
      const grossPnlUsd =
        step.returnPctNext !== undefined
          ? decision.order.sizeUsd * step.returnPctNext * sign
          : (step.pnlUsd ?? 0);
      // Charge the simulated round-trip cost (enter + exit). Net P&L is what the
      // wallet actually keeps — and what the learning loop should grade against,
      // so the agent learns that sub-cost "edges" are not worth taking.
      const costUsd = roundTripCostUsd(decision.order.sizeUsd, costModel);
      const pnlUsd = grossPnlUsd - costUsd;
      totalCostUsd += costUsd;
      if (pnlUsd > 0) wins++;

      portfolio = applyFill(portfolio, {
        txHash: "sim",
        filledAsset: decision.order.asset,
        filledUsd: decision.order.sizeUsd,
      });
      portfolio = markEquity(portfolio, portfolio.equityUsd + pnlUsd); // realize net P&L
      weights = learnFromOutcome(weights, proposal.regime, {
        pnlUsd,
        thesisHeld: step.thesisHeld,
      }).weights;
    }

    maxDrawdownPct = Math.max(maxDrawdownPct, drawdownPct(portfolio));
  }

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
