import { describe, expect, it } from "vitest";
import { mapFearGreed, mapIsHoneypot, mapOhlcvCloses, mapQuotePrice, mapX402QuotePrice } from "../src/signals/cmc.js";

describe("CMC response mappers", () => {
  it("reads price from the array-form quotes/latest shape", () => {
    const raw = { data: { CAKE: [{ quote: { USD: { price: 2.34 } } }] } };
    expect(mapQuotePrice(raw, "CAKE")).toBe(2.34);
  });

  it("reads price from the object-form quotes/latest shape", () => {
    const raw = { data: { ETH: { quote: { USD: { price: 3500 } } } } };
    expect(mapQuotePrice(raw, "ETH")).toBe(3500);
  });

  it("returns undefined when the symbol/price is missing", () => {
    expect(mapQuotePrice({ data: {} }, "CAKE")).toBeUndefined();
    expect(mapQuotePrice({}, "CAKE")).toBeUndefined();
  });

  it("picks the canonical coin by rank from the x402 array shape (impostor-safe)", () => {
    // Real shape: data is an array; multiple coins share symbol BNB.
    const res = {
      data: [
        { symbol: "BNB", is_active: 1, cmc_rank: 4, quote: [{ symbol: "USD", price: 573.72 }] },
        { symbol: "BNB", is_active: 1, cmc_rank: 7634, quote: [{ symbol: "USD", price: 0.0000225 }] }, // meme impostor
        { symbol: "BNB", is_active: 0, cmc_rank: null, quote: [{ symbol: "USD", price: null }] },
      ],
      status: { error_code: "0" },
    };
    expect(mapX402QuotePrice(res, "BNB")).toBe(573.72);
    expect(mapX402QuotePrice({ data: [] }, "BNB")).toBeUndefined();
    expect(mapX402QuotePrice({}, "BNB")).toBeUndefined();
  });

  it("reads the Fear & Greed value", () => {
    expect(mapFearGreed({ data: { value: 72 } })).toBe(72);
    expect(mapFearGreed({})).toBeUndefined();
  });

  it("extracts the ascending close series from ohlcv/historical", () => {
    const raw = {
      data: { CAKE: { quotes: [
        { quote: { USD: { close: 2.1 } } },
        { quote: { USD: { close: 2.3 } } },
        { quote: { USD: { close: 2.2 } } },
      ] } },
    };
    expect(mapOhlcvCloses(raw, "CAKE")).toEqual([2.1, 2.3, 2.2]);
    expect(mapOhlcvCloses({}, "CAKE")).toEqual([]);
  });

  it("flags honeypots from the security/detail shape", () => {
    expect(mapIsHoneypot({ data: { is_honeypot: true } })).toBe(true);
    expect(mapIsHoneypot({ data: { is_safe: false } })).toBe(true);
    expect(mapIsHoneypot({ data: { is_safe: true } })).toBe(false);
    expect(mapIsHoneypot({})).toBe(false);
  });
});
