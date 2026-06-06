import { config } from "../config.js";
import { mapFearGreed, mapOhlcvCloses, mapQuotePrice } from "./cmc.js";
import { macd, rsi } from "./indicators.js";
import type { SignalBundle } from "../types.js";

// DATA / EDGE LAYER. Live fetch from the CoinMarketCap REST API (free Basic key).
// Each source is fetched independently and tolerates failure — the free tier may
// not expose every endpoint, and a 24/7 agent must degrade gracefully (a missing
// field just means the regime detector falls back to its neutral default).
//
// Phase 2 (still pending the spike): funding/derivatives + technicals (RSI/MACD)
// via the CMC MCP tools, chain-native signals via the DEX API, and paying ≥1
// source per-call via `twak x402` (R1). Confirmed REST endpoints are wired now.

async function cmcGet(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(config.cmc.restBase + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { "X-CMC_PRO_API_KEY": config.cmc.apiKey, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`CMC ${path} → HTTP ${res.status}`);
  return res.json();
}

export async function fetchSignalBundle(asset: string): Promise<SignalBundle> {
  const bundle: SignalBundle = {
    timestamp: new Date().toISOString(),
    asset,
    cmc: {},
    chain: {},
    paidViaX402: false,
  };

  if (!config.cmc.apiKey) return bundle; // keyless → hollow bundle; rule engine still runs

  const [price, fearGreed, closes] = await Promise.all([
    cmcGet("/v2/cryptocurrency/quotes/latest", { symbol: asset })
      .then((r) => mapQuotePrice(r, asset))
      .catch((e) => {
        console.warn(`  ⚠️  quotes/latest failed: ${(e as Error).message}`);
        return undefined;
      }),
    cmcGet("/v3/fear-and-greed/latest", {})
      .then(mapFearGreed)
      .catch((e) => {
        console.warn(`  ⚠️  fear-and-greed failed (may need a higher tier): ${(e as Error).message}`);
        return undefined;
      }),
    cmcGet("/v2/cryptocurrency/ohlcv/historical", { symbol: asset, count: "60", interval: "daily" })
      .then((r) => mapOhlcvCloses(r, asset))
      .catch((e) => {
        console.warn(`  ⚠️  ohlcv/historical failed (may need a higher tier): ${(e as Error).message}`);
        return [] as number[];
      }),
  ]);

  bundle.cmc.priceUsd = price;
  bundle.cmc.fearGreed = fearGreed;
  if (closes.length) {
    bundle.cmc.rsi = rsi(closes);
    bundle.cmc.macd = macd(closes)?.macd;
  }
  return bundle;
}
