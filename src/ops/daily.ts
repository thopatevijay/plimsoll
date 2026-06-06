import { existsSync, readFileSync } from "node:fs";
import { atomicWriteJson } from "../util/io.js";

// Persisted daily trade counters so the kernel's daily-volume cap actually
// accumulates across cycles AND survives restarts (otherwise reloading the
// portfolio from chain each cycle resets them to 0 and the cap is dead code).
// Resets when the UTC date rolls over.

interface DailyCounters {
  date: string; // UTC YYYY-MM-DD
  tradesToday: number;
  tradeVolumeTodayUsd: number;
}

const PATH = "daily.json";
const utcDate = (): string => new Date().toISOString().slice(0, 10);

/** Pure: keep stored counters only if they're for `today`, else reset. */
export function rollIfStale(
  stored: DailyCounters | null,
  today: string,
): { tradesToday: number; tradeVolumeTodayUsd: number } {
  if (!stored || stored.date !== today) return { tradesToday: 0, tradeVolumeTodayUsd: 0 };
  return {
    tradesToday: stored.tradesToday ?? 0,
    tradeVolumeTodayUsd: stored.tradeVolumeTodayUsd ?? 0,
  };
}

export function loadDailyCounters(): { tradesToday: number; tradeVolumeTodayUsd: number } {
  if (!existsSync(PATH)) return { tradesToday: 0, tradeVolumeTodayUsd: 0 };
  try {
    return rollIfStale(JSON.parse(readFileSync(PATH, "utf8")) as DailyCounters, utcDate());
  } catch {
    return { tradesToday: 0, tradeVolumeTodayUsd: 0 };
  }
}

/** Record an executed trade toward today's counters (rollover-aware). */
export function recordDailyTrade(volumeUsd: number): void {
  const cur = loadDailyCounters();
  atomicWriteJson(PATH, {
    date: utcDate(),
    tradesToday: cur.tradesToday + 1,
    tradeVolumeTodayUsd: cur.tradeVolumeTodayUsd + Math.abs(volumeUsd),
  });
}
