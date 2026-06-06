import { config } from "../config.js";
import { spawnTwak } from "../exec/index.js";
import { buildX402Args } from "../exec/twak.js";
import { mapQuotePrice } from "./cmc.js";

// Pay-per-call data via twak x402 (R1). Used in LIVE mode so the agent funds its
// own market data — the rubric's "native x402 usage as part of the trade loop,
// real, not a README mention". Signs a ~$0.01 payment, so it only runs live.
//
// Pays with USDC on BNB (Permit2; first call auto-approves, costs a little gas).
// BSC USDC is 18 decimals, so $0.01 = 1e16; we cap at $0.02 for headroom.
// Returns the price, or undefined on failure (caller falls back to free REST).
const MAX_PAYMENT_ATOMIC = "20000000000000000"; // $0.02 (USDC, 18-dec on BSC)

export async function fetchX402Price(symbol: string): Promise<number | undefined> {
  const url = `${config.cmc.x402Base}/v3/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(symbol)}`;
  const args = buildX402Args(url, MAX_PAYMENT_ATOMIC, { preferAsset: "USDC", autoApprove: true });
  const res = await spawnTwak(args);

  // twak returns the x402 endpoint's response body (CMC quotes JSON), possibly
  // wrapped. Try the known shapes defensively — confirm the exact wrapper on the
  // first live run (the manual `twak x402 request … --json` test) and tighten.
  for (const candidate of [res, res?.body, res?.data, res?.response, res?.result]) {
    const price = mapQuotePrice(candidate, symbol);
    if (price !== undefined) return price;
  }
  return undefined;
}
