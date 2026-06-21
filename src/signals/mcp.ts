import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { config } from "../config.js";
import { cachedForever, cachedTTL } from "../util/cache.js";
import {
  parseFearGreedMcp,
  parseFundingRate,
  parseMacroEvents,
  parseMarketRsi,
  parseNewsHeadlines,
  parseSearchId,
  parseTechnicals,
  parseTrendingNarratives,
} from "./cmc.js";

export interface McpSignals {
  fundingRate?: number;
  fearGreed?: number;
  rsi?: number;
  macd?: number;
  marketRsi?: number;
  news?: string[];
  narratives?: string[];
  macroEvents?: string[];
}

// Market-WIDE signals (funding, F&G, narratives, macro, market-RSI) are identical
// across every asset and barely move minute-to-minute, so they're cached for
// GLOBALS_TTL_MS (env-tunable) — the single biggest CMC-credit saver, since they'd
// otherwise be re-fetched every cycle for every asset. Symbol→CMC-id never changes,
// so it's cached for the process lifetime. Only per-asset technicals + news are
// fetched fresh each cycle. Using the Agent Hub MCP layer is what scores "Best Use
// of CMC Agent Hub"; caching keeps it sustainable across the 7-day live week.
const GLOBALS_TTL_MS = Number(process.env.CMC_GLOBALS_TTL_MS) || 15 * 60 * 1000; // 15 min

interface GlobalSignals {
  fundingRate?: number;
  fearGreed?: number;
  narratives?: string[];
  macroEvents?: string[];
  marketRsi?: number;
}

type CallJson = (name: string, args: Record<string, unknown>) => Promise<unknown>;
const soft = <T>(p: Promise<T>): Promise<T | undefined> => p.catch(() => undefined);

/** Open an MCP session, run `fn`, always close. One session per call site. */
async function withMcp<T>(fn: (call: CallJson) => Promise<T>): Promise<T> {
  const transport = new StreamableHTTPClientTransport(new URL(config.cmc.mcpUrl), {
    requestInit: { headers: { "X-CMC-MCP-API-KEY": config.cmc.apiKey } },
  });
  const client = new Client({ name: "plimsoll", version: "0.1.0" });
  const call: CallJson = async (name, args) => {
    const res = (await client.callTool({ name, arguments: args })) as {
      content?: { text?: string }[];
      isError?: boolean;
    };
    if (res?.isError) throw new Error(`MCP ${name} returned an error`);
    return JSON.parse(res?.content?.[0]?.text ?? "");
  };
  try {
    await client.connect(transport);
    return await fn(call);
  } finally {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  }
}

/** Market-wide signals — cached for GLOBALS_TTL_MS (shared across all assets). */
function fetchGlobalSignals(): Promise<GlobalSignals> {
  return cachedTTL("cmc:globals", GLOBALS_TTL_MS, () =>
    withMcp(async (call) => {
      const [fundingRate, fearGreed, narratives, macroEvents, marketRsi] = await Promise.all([
        soft(call("get_global_crypto_derivatives_metrics", {}).then(parseFundingRate)),
        soft(call("get_global_metrics_latest", {}).then(parseFearGreedMcp)),
        soft(call("trending_crypto_narratives", {}).then((r) => parseTrendingNarratives(r))),
        soft(call("get_upcoming_macro_events", {}).then((r) => parseMacroEvents(r))),
        soft(call("get_crypto_marketcap_technical_analysis", {}).then(parseMarketRsi)),
      ]);
      return { fundingRate, fearGreed, narratives, macroEvents, marketRsi };
    }),
  );
}

/** Resolve a symbol to its CMC id — never changes, so cached for the process life. */
function resolveCmcId(symbol: string): Promise<string | undefined> {
  return cachedForever(`cmc:id:${symbol}`, () =>
    withMcp((call) => soft(call("search_cryptos", { query: symbol }).then((r) => parseSearchId(r, symbol)))),
  ).catch(() => undefined);
}

export async function fetchMcpSignals(symbol: string): Promise<McpSignals> {
  // Globals (cached) + the per-asset id (cached) resolve without burning credits on
  // a hit. Only the per-asset technicals + news below are fetched fresh each cycle.
  const [globals, id] = await Promise.all([
    fetchGlobalSignals().catch((): GlobalSignals => ({})),
    resolveCmcId(symbol),
  ]);

  const out: McpSignals = {
    fundingRate: globals.fundingRate,
    fearGreed: globals.fearGreed,
    narratives: globals.narratives,
    macroEvents: globals.macroEvents,
    marketRsi: globals.marketRsi,
  };

  if (id) {
    const perAsset = await withMcp(async (call) => {
      const [tech, news] = await Promise.all([
        soft(call("get_crypto_technical_analysis", { id }).then(parseTechnicals)),
        soft(call("get_crypto_latest_news", { id }).then((r) => parseNewsHeadlines(r))),
      ]);
      return { tech, news };
    }).catch(() => ({ tech: undefined, news: undefined }));
    out.rsi = perAsset.tech?.rsi14;
    out.macd = perAsset.tech?.macd;
    out.news = perAsset.news;
  }
  return out;
}
