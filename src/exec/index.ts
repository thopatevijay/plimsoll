import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../config.js";
import { resolveBscToken } from "../tokens/index.js";
import { buildSwapArgs, swapTokensFor } from "./twak.js";
import type { ExecResult, SizedOrder } from "../types.js";

const run = promisify(execFile);

// The base stable we size + settle against.
const STABLE = "USDC";

/** Spawn the twak CLI and parse its --json output. Inherits TWAK_ACCESS_ID /
 *  TWAK_HMAC_SECRET (loaded into process.env by dotenv via config import). */
// biome-ignore lint/suspicious/noExplicitAny: external CLI JSON
export async function spawnTwak(args: string[]): Promise<any> {
  const { stdout } = await run("twak", args, { env: process.env, timeout: 60_000, maxBuffer: 1 << 20 });
  return JSON.parse(stdout);
}

// EXECUTION LAYER — TWAK is the sole path (R3). In any non-"live" mode we run
// `--quote-only`: a REAL twak call against the live 0x aggregator that returns a
// quote WITHOUT signing or spending — the "dry-run-live" path that lets the whole
// agent run end-to-end on real data with zero risk. Set SENTINEL_MODE=live (with
// a funded wallet + password in keychain/TWAK_WALLET_PASSWORD) to actually trade.
export async function executeSwap(order: SizedOrder): Promise<ExecResult> {
  const quoteOnly = config.mode !== "live";
  const assetId = await resolveBscToken(order.asset);
  if (!assetId) throw new Error(`no BSC address for ${order.asset}`);

  const { from, to } = swapTokensFor(order, STABLE, assetId);
  const args = buildSwapArgs({
    from,
    to,
    usd: order.sizeUsd,
    slippageBps: order.maxSlippageBps,
    quoteOnly,
  });
  const r = await spawnTwak(args);
  if (r?.error) throw new Error(`twak swap: ${r.error}`);

  return {
    txHash: r?.txHash ?? r?.hash ?? (quoteOnly ? `DRY_RUN(out=${r?.output ?? "?"})` : "UNKNOWN"),
    filledAsset: order.asset,
    filledUsd: order.sizeUsd,
  };
}
