import { config } from "../config.js";

// Symbol → BSC token id for execution. twak knows a few symbols (BNB native,
// major stables) but not most of our 149 — those need a 0x contract address.
// We pull addresses from CMC's authoritative `info` endpoint (NOT from memory),
// with a small curated map of addresses already verified live (x402 quote + info).

/* eslint-disable @typescript-eslint/no-explicit-any */

const BSC_PLATFORM = "BNB Smart Chain (BEP20)";

// Verified canonical BSC addresses (from the live x402 quote + CMC info).
const CURATED: Record<string, string> = {
  USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  USDT: "0x55d398326f99059fF775485246999027B3197955",
  U: "0xcE24439F2D9C6a2289F741120FE202248B666666", // United Stables (x402 default)
};

/** Pure: extract the BEP-20 contract address for a symbol from CMC info data. */
export function parseBscAddress(infoEntry: any): string | undefined {
  const d = Array.isArray(infoEntry) ? infoEntry[0] : infoEntry;
  const list = d?.contract_address;
  if (!Array.isArray(list)) return undefined;
  const bsc = list.find((c: any) => c?.platform?.name === BSC_PLATFORM);
  return typeof bsc?.contract_address === "string" ? bsc.contract_address : undefined;
}

const cache = new Map<string, string>(Object.entries(CURATED));

/** Resolve a symbol to a twak-usable token id on BSC: native symbol, curated
 *  address, or fetched-from-CMC address. undefined if unresolvable. */
export async function resolveBscToken(symbol: string): Promise<string | undefined> {
  const s = symbol.toUpperCase();
  if (s === "BNB") return "BNB"; // native — twak knows it by symbol
  if (cache.has(s)) return cache.get(s);
  if (!config.cmc.apiKey) return undefined;
  try {
    const url = new URL(`${config.cmc.restBase}/v2/cryptocurrency/info`);
    url.searchParams.set("symbol", s);
    const res = await fetch(url, { headers: { "X-CMC_PRO_API_KEY": config.cmc.apiKey } });
    if (!res.ok) return undefined;
    const j: any = await res.json();
    const addr = parseBscAddress(j?.data?.[s]);
    if (addr) cache.set(s, addr);
    return addr;
  } catch {
    return undefined;
  }
}
