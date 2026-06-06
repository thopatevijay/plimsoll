// Pure mappers from CoinMarketCap REST/MCP response shapes into our SignalBundle
// fields. The live network fetch lives in signals/index (guarded by a key); these
// mappers are pure so they're unit-testable against fixtures NOW, before any key
// exists. Shapes follow the documented endpoints — confirm exact nesting in the
// spike, but the defensive extraction tolerates reasonable variation.

/* eslint-disable @typescript-eslint/no-explicit-any */

/** /v2/cryptocurrency/quotes/latest → data keyed by symbol (array or object). */
export function mapQuotePrice(raw: any, symbol: string): number | undefined {
  const entry = raw?.data?.[symbol];
  const item = Array.isArray(entry) ? entry[0] : entry;
  const price = item?.quote?.USD?.price;
  return typeof price === "number" ? price : undefined;
}

/** /v3/fear-and-greed/latest → data.value (0-100). */
export function mapFearGreed(raw: any): number | undefined {
  const v = raw?.data?.value;
  return typeof v === "number" ? v : undefined;
}

/** /v2/cryptocurrency/ohlcv/historical → ascending close-price series. */
export function mapOhlcvCloses(raw: any, symbol: string): number[] {
  const entry = raw?.data?.[symbol] ?? raw?.data;
  const quotes = entry?.quotes;
  if (!Array.isArray(quotes)) return [];
  return quotes
    .map((q: any) => q?.quote?.USD?.close)
    .filter((c: any): c is number => typeof c === "number");
}

// ---- CMC MCP (Agent Hub) response parsers ----
// MCP tools return a JSON string in content[0].text; these parse the decoded
// object. Shapes captured live from the server (see commit history).

function toNum(x: unknown): number | undefined {
  const n = typeof x === "string" ? Number.parseFloat(x) : typeof x === "number" ? x : Number.NaN;
  return Number.isFinite(n) ? n : undefined;
}

/** get_global_crypto_derivatives_metrics → fundingRate.current (string). */
export function parseFundingRate(obj: any): number | undefined {
  return toNum(obj?.fundingRate?.current);
}

/** get_global_metrics_latest → sentiment.fear_greed.current.index (0-100). */
export function parseFearGreedMcp(obj: any): number | undefined {
  const v = obj?.sentiment?.fear_greed?.current?.index;
  return typeof v === "number" ? v : undefined;
}

/** get_crypto_technical_analysis → { rsi14, macd } (string numbers). */
export function parseTechnicals(obj: any): { rsi14?: number; macd?: number } {
  return { rsi14: toNum(obj?.rsi?.rsi14), macd: toNum(obj?.macd?.macdLine) };
}

/** search_cryptos → the CMC numeric id for an exact symbol match (string). */
export function parseSearchId(arr: any, symbol: string): string | undefined {
  if (!Array.isArray(arr)) return undefined;
  const hit = arr.find((x: any) => String(x?.symbol).toUpperCase() === symbol.toUpperCase());
  const id = hit?.id ?? arr[0]?.id;
  return id !== undefined && id !== null ? String(id) : undefined;
}

/** /v1/dex/security/detail → treat anything flagged as a honeypot/high-risk as unsafe. */
export function mapIsHoneypot(raw: any): boolean {
  const d = raw?.data;
  const item = Array.isArray(d) ? d[0] : d;
  // Defensive: any explicit honeypot flag, or a missing/false "is_safe".
  if (item?.is_honeypot === true) return true;
  if (item?.is_safe === false) return true;
  return false;
}
