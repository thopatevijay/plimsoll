import { describe, expect, it } from "vitest";
import {
  parseFearGreedMcp,
  parseFundingRate,
  parseSearchId,
  parseTechnicals,
} from "../src/signals/cmc.js";

// Fixtures captured live from the CMC MCP server.

describe("MCP response parsers", () => {
  it("parses the funding rate (string → number)", () => {
    expect(parseFundingRate({ fundingRate: { current: "-0.0016923" } })).toBeCloseTo(-0.0016923);
    expect(parseFundingRate({})).toBeUndefined();
  });

  it("parses Fear & Greed from global metrics", () => {
    const obj = { sentiment: { fear_greed: { current: { value: "Extreme fear", index: 13 } } } };
    expect(parseFearGreedMcp(obj)).toBe(13);
    expect(parseFearGreedMcp({})).toBeUndefined();
  });

  it("parses RSI(14) and the MACD line from technical analysis", () => {
    const obj = { rsi: { rsi7: "23.84", rsi14: "32.77" }, macd: { macdLine: "-6.66", signalLine: "3.11" } };
    expect(parseTechnicals(obj)).toEqual({ rsi14: 32.77, macd: -6.66 });
  });

  it("resolves a symbol to its CMC id via search", () => {
    const arr = [{ id: 1839, name: "BNB", symbol: "BNB", slug: "bnb", rank: 4 }];
    expect(parseSearchId(arr, "BNB")).toBe("1839");
    expect(parseSearchId(arr, "bnb")).toBe("1839"); // case-insensitive
    expect(parseSearchId([], "BNB")).toBeUndefined();
  });
});
