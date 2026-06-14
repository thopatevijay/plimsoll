import { existsSync, readFileSync } from "node:fs";
import { config } from "../config.js";
import { constitutionHash } from "../identity/constitution.js";
import { REFS } from "../identity/refs.js";
import { MIN_LIQUIDITY_USD } from "../kernel/index.js";
import { loadWeights } from "../learning/index.js";
import { readAll } from "../ledger/index.js";
import { drawdownPct } from "../portfolio/index.js";
import { atomicWriteJson, statePath } from "../util/io.js";
import type { Constitution, LedgerEntry, PortfolioState } from "../types.js";

// Emits the agent-state snapshot the dashboard renders (plimsoll/snapshot.json,
// read by ../snapshot.json from the dashboard). Written every cycle, best-effort:
// a snapshot failure must never break the trade loop. Keeps a rolling equity curve
// across cycles so the dashboard shows a real, growing line.

const SNAPSHOT_PATH = statePath("snapshot.json");
const CURVE_MAX = 48;

const round2 = (n: number) => Math.round(n * 100) / 100;
const hhmmss = (iso: string) => (iso.length >= 19 ? iso.slice(11, 19) : iso);

function priorState(): { curve: { t: string; equity: number }[]; cycle: number } {
  try {
    if (existsSync(SNAPSHOT_PATH)) {
      const p = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
      return { curve: p?.portfolio?.equityCurve ?? [], cycle: Number(p?.cycle ?? 0) };
    }
  } catch {
    /* fresh start */
  }
  return { curve: [], cycle: 0 };
}

function ledgerRow(e: LedgerEntry) {
  const approved = e.decision.ok;
  const note = approved
    ? `${e.decision.order.direction} $${e.decision.order.sizeUsd.toFixed(0)} — ${e.proposal.regime}`
    : e.decision.reason;
  return {
    ts: hhmmss(e.ts),
    asset: e.bundle.asset,
    regime: e.proposal.regime,
    direction: e.proposal.direction,
    conviction: e.proposal.conviction,
    approved,
    note,
  };
}

export function writeSnapshot(entry: LedgerEntry, portfolio: PortfolioState, c: Constitution): void {
  try {
    const { curve, cycle } = priorState();
    const equityCurve = [...curve, { t: hhmmss(entry.ts), equity: round2(portfolio.equityUsd) }].slice(-CURVE_MAX);
    const w = loadWeights().byRegime;
    const d = entry.decision;

    const snap = {
      agent: {
        name: "PLIMSOLL",
        mode: config.mode === "live" ? "live" : "dev",
        wallet: REFS.wallet,
        agentId: REFS.agentId,
        registry: REFS.registry,
        constitutionHash: constitutionHash(),
        registered: REFS.registered,
      },
      asOf: entry.ts,
      cycle: cycle + 1,
      latestDecision: {
        asset: entry.bundle.asset,
        regime: entry.proposal.regime,
        direction: entry.proposal.direction,
        conviction: entry.proposal.conviction,
        thesis: entry.proposal.thesis,
        sizeUsd: d.ok ? d.order.sizeUsd : 0,
        approved: d.ok,
        kernelReason: d.ok ? `approved · ${d.order.direction} $${d.order.sizeUsd.toFixed(0)}` : d.reason,
      },
      signals: { cmc: entry.bundle.cmc, chain: entry.bundle.chain },
      portfolio: {
        equityUsd: round2(portfolio.equityUsd),
        peakEquityUsd: round2(portfolio.peakEquityUsd),
        drawdownPct: round2(drawdownPct(portfolio)),
        equityCurve,
      },
      learning: { trending: w.trending, chopping: w.chopping, risk_off: w.risk_off },
      guardrails: {
        allowlist: c.allowlist.symbols.length,
        perTradePct: c.sizing.perTradeMaxPctOfEquity,
        dailyPct: c.sizing.dailyMaxTradeVolumePctOfEquity,
        slippageBps: c.sizing.maxSlippageBps,
        liquidityFloorUsd: MIN_LIQUIDITY_USD,
        killSwitchPct: c.risk.hardDrawdownPct,
        dqPct: c.risk.dqDrawdownPct,
        honeypotGate: true,
      },
      ledger: readAll().slice(-8).reverse().map(ledgerRow),
      backtest: REFS.backtest,
      proof: REFS.proof,
    };

    atomicWriteJson(SNAPSHOT_PATH, snap);
  } catch {
    /* snapshot is cosmetic — never break the trade loop */
  }
}
