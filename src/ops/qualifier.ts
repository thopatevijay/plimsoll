import { executeSwap } from "../exec/index.js";
import { append } from "../ledger/index.js";
import type { Direction, LedgerEntry, PortfolioState, SizedOrder } from "../types.js";
import { loadDailyCounters, recordDailyTrade } from "./daily.js";

// DAILY-TRADE QUALIFIER. The competition disqualifies / zero-scores a day with no
// trade through the TWAK swap interface (min ≥1 trade/day). On a quiet risk-off day
// the strategy correctly makes none — so this fires ONE minimal stable↔stable swap
// (USDC↔USDT, both allowlisted) to stay qualified at near-zero market risk. It is a
// COMPLIANCE action, deliberately outside the strategy kernel: a tiny fixed swap
// between two stables carries no directional risk, and the kernel would (correctly)
// veto a "buy" in risk-off. Mirrors the organizer guidance: if no signal, take the
// mandatory trade at minimum size. Fires late in the UTC day so the strategy gets
// first chance to satisfy the rule naturally (no redundant cost on active days).

const STABLE_ASSET = "USDT"; // the non-USDC leg; USDC is exec's base stable

function envNum(name: string, def: number, min: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= min ? n : def;
}

export interface QualifierPlan {
  direction: Direction; // buy = USDC→USDT, sell = USDT→USDC
  sizeUsd: number;
}

/** Pure: decide whether (and how) to fire the daily qualifier. Returns null to skip.
 *  Sources from whichever stable we hold more of, so it never runs dry. */
export function planQualifier(opts: {
  tradesToday: number;
  hourUtc: number;
  usdcUsd: number;
  usdtUsd: number;
  sizeUsd: number;
  hourThresholdUtc: number;
}): QualifierPlan | null {
  if (opts.tradesToday > 0) return null; // strategy already satisfied the day
  if (opts.hourUtc < opts.hourThresholdUtc) return null; // give the strategy the day first
  const direction: Direction = opts.usdcUsd >= opts.usdtUsd ? "buy" : "sell";
  const available = direction === "buy" ? opts.usdcUsd : opts.usdtUsd;
  if (!(available >= opts.sizeUsd)) return null; // not enough of either stable (shouldn't happen)
  return { direction, sizeUsd: opts.sizeUsd };
}

/** Fire the daily qualifier if needed. Returns the exec result (or null if skipped).
 *  Best-effort: never throws into the trade loop — a qualifier failure is logged by
 *  the caller. Reads daily counters fresh so a strategy trade earlier this cycle counts. */
export async function maybeRunDailyQualifier(
  portfolio: PortfolioState,
  now = new Date(),
): Promise<{ order: SizedOrder; txHash: string } | null> {
  const { tradesToday } = loadDailyCounters();
  const plan = planQualifier({
    tradesToday,
    hourUtc: now.getUTCHours(),
    usdcUsd: portfolio.positions.USDC ?? 0,
    usdtUsd: portfolio.positions[STABLE_ASSET] ?? 0,
    sizeUsd: envNum("PLIMSOLL_QUALIFIER_USD", 2, 0.5),
    hourThresholdUtc: envNum("PLIMSOLL_QUALIFIER_HOUR_UTC", 22, 0),
  });
  if (!plan) return null;

  const order: SizedOrder = {
    asset: STABLE_ASSET,
    direction: plan.direction,
    sizeUsd: plan.sizeUsd,
    maxSlippageBps: 50, // stables barely move; 0.5% is ample
  };
  const exec = await executeSwap(order);
  recordDailyTrade(order.sizeUsd); // mark the day qualified so it won't re-fire

  const entry: LedgerEntry = {
    ts: now.toISOString(),
    bundle: { timestamp: now.toISOString(), asset: STABLE_ASSET, cmc: {}, chain: {} },
    proposal: {
      regime: "chopping",
      asset: STABLE_ASSET,
      direction: plan.direction,
      conviction: 0,
      thesis: "daily qualifier — minimal USDC↔USDT swap to satisfy ≥1 trade/day at near-zero risk",
    },
    decision: { ok: true, order },
    exec,
  };
  append(entry);
  return { order, txHash: exec.txHash };
}
