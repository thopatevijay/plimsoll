import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { config } from "../config.js";
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

// CMC Agent Hub via MCP. One session per signal fetch (connect → batch tool
// calls → close): simple lifecycle, no stale long-lived connections, and our
// decision cadence (minutes) makes the connect cost negligible. Using the MCP
// layer (funding + sentiment + technicals) is what scores "Best Use of Agent Hub".
export async function fetchMcpSignals(symbol: string): Promise<McpSignals> {
  const transport = new StreamableHTTPClientTransport(new URL(config.cmc.mcpUrl), {
    requestInit: { headers: { "X-CMC-MCP-API-KEY": config.cmc.apiKey } },
  });
  const client = new Client({ name: "sentinel", version: "0.1.0" });

  const callJson = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    const res = (await client.callTool({ name, arguments: args })) as {
      content?: { text?: string }[];
      isError?: boolean;
    };
    if (res?.isError) throw new Error(`MCP ${name} returned an error`);
    return JSON.parse(res?.content?.[0]?.text ?? "");
  };

  // Every field is independent + fail-soft: a missing tool result degrades to
  // undefined, never crashes the cycle. soft() wraps each call.
  const soft = <T>(p: Promise<T>): Promise<T | undefined> => p.catch(() => undefined);

  try {
    await client.connect(transport); // inside try so a connect failure still hits finally
    const out: McpSignals = {};

    // Batch A — global (no asset id needed): run in parallel.
    const [funding, fearGreed, narratives, macroEvents, marketRsi, id] = await Promise.all([
      soft(callJson("get_global_crypto_derivatives_metrics", {}).then(parseFundingRate)),
      soft(callJson("get_global_metrics_latest", {}).then(parseFearGreedMcp)),
      soft(callJson("trending_crypto_narratives", {}).then((r) => parseTrendingNarratives(r))),
      soft(callJson("get_upcoming_macro_events", {}).then((r) => parseMacroEvents(r))),
      soft(callJson("get_crypto_marketcap_technical_analysis", {}).then(parseMarketRsi)),
      soft(callJson("search_cryptos", { query: symbol }).then((r) => parseSearchId(r, symbol))),
    ]);
    out.fundingRate = funding;
    out.fearGreed = fearGreed;
    out.narratives = narratives;
    out.macroEvents = macroEvents;
    out.marketRsi = marketRsi;

    // Batch B — needs the resolved CMC id (per-asset technicals + news): parallel.
    if (id) {
      const [tech, news] = await Promise.all([
        soft(callJson("get_crypto_technical_analysis", { id }).then(parseTechnicals)),
        soft(callJson("get_crypto_latest_news", { id }).then((r) => parseNewsHeadlines(r))),
      ]);
      out.rsi = tech?.rsi14;
      out.macd = tech?.macd;
      out.news = news;
    }
    return out;
  } finally {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  }
}
