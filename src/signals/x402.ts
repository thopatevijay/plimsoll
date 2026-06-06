import { config } from "../config.js";
import { spawnTwak } from "../exec/index.js";
import { buildX402Args } from "../exec/twak.js";
import { mapX402QuotePrice } from "./cmc.js";

// Pay-per-call data via twak x402 (R1). Used in LIVE mode so the agent funds its
// own market data — the rubric's "native x402 usage as part of the trade loop,
// real, not a README mention". Signs a ~$0.01 payment, so it only runs live.
//
// Pays with USDC on BNB (Permit2; first call auto-approves, costs a little gas).
// BSC USDC is 18 decimals, so $0.01 = 1e16; we cap at $0.02 for headroom.
// Returns the price, or undefined on failure (caller falls back to free REST).
const MAX_PAYMENT_ATOMIC = "20000000000000000"; // $0.02 (USDC, 18-dec on BSC)
// Pin the USDC route by CONTRACT ADDRESS: --prefer-asset matches the token NAME
// ("USD Coin"), and "USDC" is not a substring of it. The address is exact.
const USDC_BSC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";

export async function fetchX402Price(symbol: string): Promise<number | undefined> {
  const url = `${config.cmc.x402Base}/v3/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(symbol)}`;
  const args = buildX402Args(url, MAX_PAYMENT_ATOMIC, { preferAsset: USDC_BSC, autoApprove: true });
  // Confirmed live: `twak x402 request --json` returns the CMC response directly
  // ({ data: Coin[], status }). mapX402QuotePrice handles the array shape + picks
  // the canonical coin by rank (guards against meme-symbol impostors).
  const res = await spawnTwak(args);
  return mapX402QuotePrice(res, symbol);
}
