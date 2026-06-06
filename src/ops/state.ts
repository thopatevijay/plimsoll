import { existsSync, readFileSync } from "node:fs";
import { spawnTwak } from "../exec/index.js";
import { atomicWriteJson } from "../util/io.js";
import type { PortfolioState } from "../types.js";

// Restart-state recovery (Phase 5). A 24/7 agent must rebuild its state from the
// CHAIN on every boot — never trust local memory it may have lost on a crash, or
// it'll double-trade / mis-size. The equity peak is persisted separately so the
// drawdown kill-switch (the DQ floor) survives reboots.

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Pure: sum usdValue → equity, symbol→usdValue → positions. */
export function parseWalletPortfolio(holdings: any): {
  equityUsd: number;
  positions: Record<string, number>;
} {
  const list = Array.isArray(holdings) ? holdings : [];
  let equityUsd = 0;
  const positions: Record<string, number> = {};
  for (const h of list) {
    const usd = typeof h?.usdValue === "number" ? h.usdValue : 0;
    equityUsd += usd;
    if (h?.symbol) positions[String(h.symbol)] = (positions[String(h.symbol)] ?? 0) + usd;
  }
  return { equityUsd, positions };
}

const PEAK_PATH = "peak.json";

function loadPeak(): number {
  if (!existsSync(PEAK_PATH)) return 0;
  try {
    return Number(JSON.parse(readFileSync(PEAK_PATH, "utf8")).peakEquityUsd) || 0;
  } catch {
    return 0;
  }
}

export function savePeak(peakEquityUsd: number): void {
  atomicWriteJson(PEAK_PATH, { peakEquityUsd });
}

/** Read live wallet equity from chain (twak portfolio) → PortfolioState. The peak
 *  is max(persisted, current) so drawdown tracking survives restarts. */
export async function loadPortfolioFromChain(): Promise<PortfolioState> {
  const holdings = await spawnTwak(["wallet", "portfolio", "--chains", "bsc", "--json"]);
  const { equityUsd, positions } = parseWalletPortfolio(holdings);
  // Only ratchet the persisted peak from a sane (finite, positive) read — a bad
  // chain read must not permanently corrupt the drawdown floor.
  const persistedPeak = loadPeak();
  const goodRead = Number.isFinite(equityUsd) && equityUsd > 0;
  const peakEquityUsd = goodRead ? Math.max(persistedPeak, equityUsd) : persistedPeak;
  if (goodRead) savePeak(peakEquityUsd);
  // Daily counters reset on boot; the daily-qualifier (twak automate) guarantees
  // the trade minimum independently, so a mid-day restart can't cause a DQ there.
  return { equityUsd, peakEquityUsd, positions, tradesToday: 0, tradeVolumeTodayUsd: 0 };
}
