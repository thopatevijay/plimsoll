import { describe, expect, it } from "vitest";
import {
  parseMacroEvents,
  parseMarketRsi,
  parseNewsHeadlines,
  parseTrendingNarratives,
} from "../src/signals/cmc.js";

// Breadth signals (1.2) — pure parsers over CMC's {headers, rows} tables.
// Header-index based so they survive column reordering, and fail soft to [].

describe("parseNewsHeadlines", () => {
  const raw = {
    headers: ["title", "description", "content", "url", "publishedAt", "quality"],
    rows: [
      ["BTC breaks resistance", "...", "...", "u1", "t1", "high"],
      ["ETF inflows surge", "...", "...", "u2", "t2", "high"],
      ["Altcoin rotation begins", "...", "...", "u3", "t3", "med"],
      ["Fourth headline", "...", "...", "u4", "t4", "low"],
    ],
  };
  it("extracts top-N titles", () => {
    expect(parseNewsHeadlines(raw, 2)).toEqual(["BTC breaks resistance", "ETF inflows surge"]);
  });
  it("survives column reordering (header-index based)", () => {
    const reordered = { headers: ["url", "title", "quality"], rows: [["u", "Reordered title", "high"]] };
    expect(parseNewsHeadlines(reordered, 1)).toEqual(["Reordered title"]);
  });
  it("fails soft on garbage", () => {
    expect(parseNewsHeadlines(null)).toEqual([]);
    expect(parseNewsHeadlines({})).toEqual([]);
    expect(parseNewsHeadlines({ headers: ["x"], rows: [] })).toEqual([]);
  });
});

describe("parseTrendingNarratives", () => {
  it("extracts narrative names from categoryList", () => {
    const raw = {
      categoryList: {
        headers: ["trendingRank", "slug", "categoryCmcUrl", "categoryName", "marketCapUsd"],
        rows: [
          [1, "ai", "u", "AI Agents", "1e9"],
          [2, "rwa", "u", "Real World Assets", "2e9"],
        ],
      },
    };
    expect(parseTrendingNarratives(raw, 5)).toEqual(["AI Agents", "Real World Assets"]);
  });
  it("fails soft when categoryList is missing", () => {
    expect(parseTrendingNarratives({})).toEqual([]);
  });
});

describe("parseMacroEvents", () => {
  it("formats title (date)", () => {
    const raw = {
      upcomingEventNews: {
        headers: ["title", "content", "url", "eventDate", "originalNewsContent"],
        rows: [["FOMC decision", "...", "u", "2026-06-18", "..."]],
      },
    };
    expect(parseMacroEvents(raw, 3)).toEqual(["FOMC decision (2026-06-18)"]);
  });
  it("uses bare title when no date column", () => {
    const raw = { upcomingEventNews: { headers: ["title"], rows: [["CPI release"]] } };
    expect(parseMacroEvents(raw)).toEqual(["CPI release"]);
  });
  it("fails soft on garbage", () => {
    expect(parseMacroEvents(undefined)).toEqual([]);
  });
});

describe("parseMarketRsi", () => {
  it("reads rsi14 as a number", () => {
    expect(parseMarketRsi({ rsi: { rsi7: "11.38", rsi14: "14.21", rsi21: "21.46" } })).toBe(14.21);
  });
  it("returns undefined on missing/non-numeric", () => {
    expect(parseMarketRsi({})).toBeUndefined();
    expect(parseMarketRsi({ rsi: { rsi14: "n/a" } })).toBeUndefined();
  });
});
