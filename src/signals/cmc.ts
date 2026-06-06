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

/** /v1/dex/security/detail → treat anything flagged as a honeypot/high-risk as unsafe. */
export function mapIsHoneypot(raw: any): boolean {
  const d = raw?.data;
  const item = Array.isArray(d) ? d[0] : d;
  // Defensive: any explicit honeypot flag, or a missing/false "is_safe".
  if (item?.is_honeypot === true) return true;
  if (item?.is_safe === false) return true;
  return false;
}
