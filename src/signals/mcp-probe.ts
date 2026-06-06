import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { config } from "../config.js";

const transport = new StreamableHTTPClientTransport(new URL(config.cmc.mcpUrl), {
  requestInit: { headers: { "X-CMC-MCP-API-KEY": config.cmc.apiKey } },
});
const client = new Client({ name: "sentinel-probe", version: "0.1.0" });
await client.connect(transport);

const { tools } = await client.listTools();
const sc = tools.find((t) => t.name === "search_cryptos");
console.log("=== search_cryptos schema ===");
console.log(JSON.stringify(sc?.inputSchema));

async function callJson(name: string, args: Record<string, unknown>): Promise<any> {
  const res: any = await client.callTool({ name, arguments: args });
  const text = res?.content?.[0]?.text ?? "";
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text.slice(0, 400), _isError: res?.isError };
  }
}

for (const args of [{ query: "BNB" }, { keyword: "BNB" }, { symbol: "BNB" }, { q: "BNB" }]) {
  const r = await callJson("search_cryptos", args);
  console.log(`\n=== search_cryptos ${JSON.stringify(args)} ===`);
  console.log(JSON.stringify(r).slice(0, 700));
}

await client.close();
