import { ruleProposer } from "../brain/rules.js";
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
  /** Realized result IF we trade this step (from the caller's price series). */
  pnlUsd: number;
  thesisHeld: boolean;
}

export interface BacktestResult {
  startEquityUsd: number;
  finalEquityUsd: number;
  peakEquityUsd: number;
  maxDrawdownPct: number;
  trades: number;
  weights: ConfidenceWeights;
}

export function runBacktest(
  steps: BacktestStep[],
  c: Constitution,
  startEquityUsd: number,
): BacktestResult {
  let portfolio = emptyPortfolio(startEquityUsd);
  let weights = initialWeights();
  let trades = 0;
  let maxDrawdownPct = 0;

  for (const step of steps) {
    portfolio = startNewDay(portfolio); // one step = one trading day
    const proposal = applyWeights(ruleProposer(step.bundle), weights);
    const decision = evaluate(proposal, portfolio, c);

    if (decision.ok) {
      trades++;
      portfolio = applyFill(portfolio, {
        txHash: "sim",
        filledAsset: decision.order.asset,
        filledUsd: decision.order.sizeUsd,
      });
      portfolio = markEquity(portfolio, portfolio.equityUsd + step.pnlUsd); // realize P&L
      weights = learnFromOutcome(weights, proposal.regime, {
        pnlUsd: step.pnlUsd,
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
    weights,
  };
}
