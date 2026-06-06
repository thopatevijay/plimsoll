import type { SizedOrder } from "../types.js";

// Pure builders for the `twak` CLI argv (v0.17.0, verified live). TWAK is the
// SOLE execution layer (R3); x402 also goes through twak (R1). The actual spawn
// happens in exec/index — building the args is pure + testable.
//
// Verified in the spike: swaps route via the 0x aggregator on BSC; `--usd` sizes
// in USD-equivalent (matches our sizeUsd); quotes need no password. Tokens twak
// doesn't know by symbol (e.g. CAKE) need a 0x contract address — the caller
// resolves symbol→address (token registry) and passes the id here.

/** `twak swap <from> <to> --usd <amt> --chain bsc --slippage <pct> [--quote-only]` */
const HARD_MAX_SLIPPAGE_BPS = 300; // defense-in-depth cap for a LIVE swap

export function buildSwapArgs(opts: {
  from: string;
  to: string;
  usd: number;
  slippageBps: number;
  chain?: string;
  quoteOnly?: boolean;
}): string[] {
  // Validate at the boundary — a bad size must never reach a live swap.
  if (!Number.isFinite(opts.usd) || opts.usd <= 0) {
    throw new Error(`refusing swap: invalid usd size ${opts.usd}`);
  }
  const slippagePct = Math.min(Math.max(opts.slippageBps, 0), HARD_MAX_SLIPPAGE_BPS) / 100;
  const args = [
    "swap",
    opts.from,
    opts.to,
    "--usd",
    String(opts.usd),
    "--chain",
    opts.chain ?? "bsc",
    "--slippage",
    String(slippagePct),
    "--json",
  ];
  if (opts.quoteOnly) args.push("--quote-only");
  return args;
}

/** Map a sized order to from/to token ids (buy = stable→asset, sell = asset→stable). */
export function swapTokensFor(
  order: SizedOrder,
  stable: string,
  assetId: string,
): { from: string; to: string } {
  return order.direction === "buy" ? { from: stable, to: assetId } : { from: assetId, to: stable };
}

/** `twak x402 request <url> --max-payment <atomic> --yes --json` (R1 — x402 via twak).
 *  preferAsset pins the payment token (e.g. "USDC"); autoApprove handles the
 *  one-time Permit2 approval for non-gasless routes. */
export function buildX402Args(
  url: string,
  maxPaymentAtomic: string,
  opts?: { preferAsset?: string; autoApprove?: boolean },
): string[] {
  const args = ["x402", "request", url, "--max-payment", maxPaymentAtomic, "--yes", "--json"];
  if (opts?.preferAsset) args.push("--prefer-asset", opts.preferAsset);
  if (opts?.autoApprove) args.push("--auto-approve");
  return args;
}

/** `twak compete register --json` (CLI-only; on-chain on BSC). */
export function buildCompeteRegisterArgs(): string[] {
  return ["compete", "register", "--json"];
}

/** Daily qualifier as a `twak automate add` DCA job (R2 — native autonomous mode). */
export function buildAutomateQualifierArgs(opts: {
  from: string;
  to: string;
  amount: number; // source-token units per run (≈ USD for a stable source)
  interval?: string;
  chain?: string;
}): string[] {
  return [
    "automate",
    "add",
    "--from",
    opts.from,
    "--to",
    opts.to,
    "--chain",
    opts.chain ?? "bsc",
    "--amount",
    String(opts.amount),
    "--interval",
    opts.interval ?? "1d",
    "--json",
  ];
}
