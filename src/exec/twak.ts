import type { SizedOrder } from "../types.js";

// Pure builders for the `twak` CLI argv. TWAK is the SOLE execution layer (hard
// rule R3); x402 also goes through twak (R1). The actual spawn happens in
// exec/index once credentials + the Phase-0 spike land — building the args is
// pure and testable now.
//
// NOTE: `twak swap <amount> ...` takes the amount in the FROM token. We assume a
// stable from-token (USDC ≈ $1) so sizeUsd ≈ amount; confirm amount semantics +
// the BSC route (1inch/KyberSwap/0x) in the spike.

export function buildSwapArgs(
  order: SizedOrder,
  opts: { stable: string; chain?: string },
): string[] {
  const chain = opts.chain ?? "bsc";
  const slippagePct = (order.maxSlippageBps / 100).toString();
  const [from, to] =
    order.direction === "buy" ? [opts.stable, order.asset] : [order.asset, opts.stable];
  return ["swap", String(order.sizeUsd), from, to, "--chain", chain, "--slippage", slippagePct];
}

/** `twak x402 request <url> --max-payment <atomic> --yes` (R1: x402 via twak). */
export function buildX402Args(url: string, maxPaymentAtomic: string): string[] {
  return ["x402", "request", url, "--max-payment", maxPaymentAtomic, "--yes"];
}

/** `twak compete register --json` (CLI-only; on-chain on BSC). */
export function buildCompeteRegisterArgs(): string[] {
  return ["compete", "register", "--json"];
}

/** The daily qualifier as a TWAK automate (DCA) job (R2 — native autonomous mode). */
export function buildAutomateQualifierArgs(opts: {
  stable: string;
  asset: string;
  amountUsd: number;
  chain?: string;
}): string[] {
  const chain = opts.chain ?? "bsc";
  return [
    "automate",
    "add",
    "--from", opts.stable,
    "--to", opts.asset,
    "--chain", chain,
    "--amount", String(opts.amountUsd),
    "--interval", "1d",
  ];
}
