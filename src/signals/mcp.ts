import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { config } from "../config.js";
import { parseFearGreedMcp, parseFundingRate, parseSearchId, parseTechnicals } from "./cmc.js";

export interface McpSignals {
  fundingRate?: number;
  fearGreed?: number;
  rsi?: number;
  macd?: number;
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
  await client.connect(transport);

  const callJson = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    const res = (await client.callTool({ name, arguments: args })) as {
      content?: { text?: string }[];
      isError?: boolean;
    };
    if (res?.isError) throw new Error(`MCP ${name} returned an error`);
    return JSON.parse(res?.content?.[0]?.text ?? "");
  };

  try {
    const out: McpSignals = {};
    out.fundingRate = await callJson("get_global_crypto_derivatives_metrics", {})
      .then(parseFundingRate)
      .catch(() => undefined);
    out.fearGreed = await callJson("get_global_metrics_latest", {})
      .then(parseFearGreedMcp)
      .catch(() => undefined);

    const id = await callJson("search_cryptos", { query: symbol })
      .then((r) => parseSearchId(r, symbol))
      .catch(() => undefined);
    if (id) {
      const t = await callJson("get_crypto_technical_analysis", { id })
        .then(parseTechnicals)
        .catch(() => ({}) as ReturnType<typeof parseTechnicals>);
      out.rsi = t.rsi14;
      out.macd = t.macd;
    }
    return out;
  } finally {
    await client.close().catch(() => {});
  }
}
