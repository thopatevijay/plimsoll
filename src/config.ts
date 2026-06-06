import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Constitution } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Fail loud on missing required secrets at startup, not mid-trade at 3am.
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name} (see .env.example)`);
  return v;
}
function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const config = {
  mode: optional("SENTINEL_MODE", "dev"),
  llm: {
    provider: optional("LLM_PROVIDER", "openai"),
    apiKey: optional("OPENAI_API_KEY"), // optional so the tracer bullet runs keyless
    model: optional("LLM_MODEL", "gpt-4o-mini"),
  },
  cmc: {
    apiKey: optional("CMC_API_KEY"),
    mcpUrl: optional("CMC_MCP_URL", "https://mcp.coinmarketcap.com/mcp"),
    restBase: optional("CMC_REST_BASE", "https://pro-api.coinmarketcap.com"),
    x402Base: optional("CMC_X402_BASE", "https://pro-api.coinmarketcap.com/x402"),
  },
  twak: {
    accessId: optional("TWAK_ACCESS_ID"),
    hmacSecret: optional("TWAK_HMAC_SECRET"),
  },
  wallet: {
    agentKey: optional("AGENT_PRIVATE_KEY"),
    x402Key: optional("X402_PRIVATE_KEY"),
  },
  bsc: {
    rpcUrl: optional("BSC_RPC_URL", "https://bsc-dataseed.binance.org"),
    chainId: Number(optional("BSC_CHAIN_ID", "56")),
  },
  telegram: {
    botToken: optional("TELEGRAM_BOT_TOKEN"),
    chatId: optional("TELEGRAM_CHAT_ID"),
  },
};

export function loadConstitution(): Constitution {
  const raw = readFileSync(join(__dirname, "..", "constitution.json"), "utf8");
  return JSON.parse(raw) as Constitution;
}

export { required };
