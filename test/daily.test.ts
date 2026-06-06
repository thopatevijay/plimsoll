import { describe, expect, it } from "vitest";
import { rollIfStale } from "../src/ops/daily.js";

describe("daily counters rollover", () => {
  it("keeps counters from today", () => {
    const stored = { date: "2026-06-22", tradesToday: 3, tradeVolumeTodayUsd: 120 };
    expect(rollIfStale(stored, "2026-06-22")).toEqual({ tradesToday: 3, tradeVolumeTodayUsd: 120 });
  });

  it("resets when the date rolled over", () => {
    const stored = { date: "2026-06-21", tradesToday: 3, tradeVolumeTodayUsd: 120 };
    expect(rollIfStale(stored, "2026-06-22")).toEqual({ tradesToday: 0, tradeVolumeTodayUsd: 0 });
  });

  it("resets on null/missing", () => {
    expect(rollIfStale(null, "2026-06-22")).toEqual({ tradesToday: 0, tradeVolumeTodayUsd: 0 });
  });
});
