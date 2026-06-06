import { config } from "../config.js";

// Symbol → BSC token id for execution, IMPOSTOR-SAFE. CMC lists multiple coins
// per symbol (e.g. 4 "BNB": the real one + meme impostors), so we never trust a
// bare symbol lookup. We resolve to the canonical CMC id (active, lowest rank)
// via quotes/latest, then fetch that exact id's BEP-20 address. A small curated
// map short-circuits the stables/natives we already verified live.

/* eslint-disable @typescript-eslint/no-explicit-any */

const BSC_PLATFORM = "BNB Smart Chain (BEP20)";

const CURATED: Record<string, string> = {
  USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  USDT: "0x55d398326f99059fF775485246999027B3197955",
  U: "0xcE24439F2D9C6a2289F741120FE202248B666666", // United Stables (x402 default)
};

/** Pure: from quotes/latest data[symbol] (array of same-symbol coins), pick the
 *  canonical CMC id — active coin with the lowest cmc_rank. Impostor guard. */
export function mapCanonicalId(quotesRes: any, symbol: string): number | undefined {
  const sym = symbol.toUpperCase();
  const entry = quotesRes?.data?.[sym] ?? quotesRes?.data?.[symbol];
  const list = Array.isArray(entry) ? entry : entry ? [entry] : [];
  const matches = list.filter((c: any) => String(c?.symbol).toUpperCase() === sym && c?.is_active === 1);
  const pool = matches.length ? matches : list;
  let bestId: number | undefined;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const c of pool) {
    const rank = typeof c?.cmc_rank === "number" ? c.cmc_rank : Number.POSITIVE_INFINITY;
    if (rank < bestRank && typeof c?.id === "number") {
      bestRank = rank;
      bestId = c.id;
    }
  }
  return bestId;
}

/** Pure: extract the BEP-20 contract address for a coin from CMC info data. */
export function parseBscAddress(infoEntry: any): string | undefined {
  const d = Array.isArray(infoEntry) ? infoEntry[0] : infoEntry;
  const list = d?.contract_address;
  if (!Array.isArray(list)) return undefined;
  const bsc = list.find((c: any) => c?.platform?.name === BSC_PLATFORM);
  return typeof bsc?.contract_address === "string" ? bsc.contract_address : undefined;
}

const cache = new Map<string, string>(Object.entries(CURATED));

async function cmcGet(path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(config.cmc.restBase + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { "X-CMC_PRO_API_KEY": config.cmc.apiKey } });
  if (!res.ok) throw new Error(`CMC ${path} → HTTP ${res.status}`);
  return res.json();
}

/** Resolve a symbol to a twak-usable BSC token id: native symbol, curated
 *  address, or canonical-id → address from CMC. undefined if unresolvable. */
export async function resolveBscToken(symbol: string): Promise<string | undefined> {
  const s = symbol.toUpperCase();
  if (s === "BNB") return "BNB"; // native — twak knows it by symbol
  if (cache.has(s)) return cache.get(s);
  if (!config.cmc.apiKey) return undefined;
  try {
    // 1) canonical CMC id (impostor-safe), 2) that exact id's BEP-20 address
    const quotes = await cmcGet("/v2/cryptocurrency/quotes/latest", { symbol: s, aux: "cmc_rank,is_active" });
    const id = mapCanonicalId(quotes, s);
    if (id === undefined) return undefined;
    const info = await cmcGet("/v2/cryptocurrency/info", { id: String(id) });
    const addr = parseBscAddress(info?.data?.[String(id)]);
    if (addr) cache.set(s, addr);
    return addr;
  } catch {
    return undefined;
  }
}
