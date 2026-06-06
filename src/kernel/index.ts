import { drawdownPct } from "../portfolio/index.js";
import type {
  Constitution,
  KernelDecision,
  PortfolioState,
  Proposal,
} from "../types.js";

// SAFETY LAYER — the deterministic risk kernel. PURE function (no I/O) so it's
// exhaustively unit-testable and impossible to "talk past" with a prompt. Every
// order must pass here BEFORE it reaches the signer. This is the guardrail the
// TWAK special rewards and the floor that keeps us out of DQ.
//
// NOTE: enforcement is in OUR code, not at the signing key — TWAK has no signing
// policy (confirmed). We do NOT claim "physically unsignable"; we claim "no
// out-of-policy order is ever constructed or sent."
export function evaluate(
  proposal: Proposal,
  portfolio: PortfolioState,
  c: Constitution,
): KernelDecision {
  // 1. Hold = no-op, trivially fine.
  if (proposal.direction === "hold") return { ok: false, reason: "proposal is hold" };

  // 2. Allowlist — trades outside the 149 eligible tokens do not count.
  if (!c.allowlist.symbols.includes(proposal.asset)) {
    return { ok: false, reason: `asset ${proposal.asset} not in allowlist` };
  }

  // 3. Drawdown kill-switch — the hard floor. Trips well below the DQ line.
  const dd = drawdownPct(portfolio);
  if (dd >= c.risk.hardDrawdownPct) {
    return { ok: false, reason: `drawdown ${dd.toFixed(1)}% >= kill-switch ${c.risk.hardDrawdownPct}%` };
  }

  // 4. Daily volume cap — limits churn (simulated tx costs penalize it) and
  //    bounds how much the agent can move in a single day.
  const dailyCapUsd = portfolio.equityUsd * (c.sizing.dailyMaxTradeVolumePctOfEquity / 100);
  const dailyRemainingUsd = dailyCapUsd - portfolio.tradeVolumeTodayUsd;
  if (dailyRemainingUsd <= 0) {
    return { ok: false, reason: `daily volume cap reached (${c.sizing.dailyMaxTradeVolumePctOfEquity}% of equity)` };
  }

  // 5. Size by conviction, capped by BOTH the per-trade limit and the daily
  //    remaining budget. (Phase 4: vol-targeting replaces flat per-trade cap.)
  const perTradeCapUsd = portfolio.equityUsd * (c.sizing.perTradeMaxPctOfEquity / 100);
  const sizeUsd = Math.min(perTradeCapUsd * clamp01(proposal.conviction), perTradeCapUsd, dailyRemainingUsd);
  if (sizeUsd <= 0) return { ok: false, reason: "computed size <= 0" };

  return {
    ok: true,
    order: {
      asset: proposal.asset,
      direction: proposal.direction,
      sizeUsd,
      maxSlippageBps: c.sizing.maxSlippageBps,
    },
  };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
