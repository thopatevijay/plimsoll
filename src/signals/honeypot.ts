// PRE-BUY HONEYPOT CHECK. A honeypot token lets you buy but not sell (or sells
// only at a punitive tax) — the classic way an autonomous buyer gets its capital
// trapped. honeypot.is actually SIMULATES a buy then a sell on a fork and reports
// whether the sell succeeds + the realized tax, which is the truest test (better
// than static heuristics). Free, no key, supports BSC (chainID 56).
//
// Fail-OPEN by design: on any API/parse error we return `checked:false` and DON'T
// block, so an outage degrades to the other defenses (the 148-token CMC allowlist
// + the on-chain liquidity floor) rather than bricking every buy. A *positive*
// honeypot verdict, however, is a hard refuse in the kernel.

const HONEYPOT_API = "https://api.honeypot.is/v2/IsHoneypot";
const REQUEST_TIMEOUT_MS = 8_000;
// A sell tax this high effectively traps capital even if the token technically
// "can" be sold — treat it as a honeypot for buy purposes.
export const MAX_SELL_TAX_PCT = 30;

export interface HoneypotResult {
  checked: boolean; // did we get a usable verdict? (false = unverified, fail-open)
  isHoneypot: boolean; // true = unsafe to buy
  sellTaxPct?: number;
  buyTaxPct?: number;
  reason?: string;
}

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Pure: interpret a honeypot.is v2 response into a buy / no-buy verdict. */
export function parseHoneypot(raw: any): HoneypotResult {
  if (!raw || typeof raw !== "object") return { checked: false, isHoneypot: false };

  const verdict = raw.honeypotResult?.isHoneypot;
  const simOk = raw.simulationSuccess === true;
  const sellTaxPct = num(raw.simulationResult?.sellTax);
  const buyTaxPct = num(raw.simulationResult?.buyTax);

  // A positive honeypot verdict is trusted even if the sim flag is shaky — safer.
  if (verdict === true) {
    return { checked: true, isHoneypot: true, sellTaxPct, buyTaxPct, reason: "honeypot.is: sell simulation fails" };
  }
  // Only trust a "safe" answer when the simulation actually succeeded.
  if (simOk && verdict === false) {
    if (sellTaxPct !== undefined && sellTaxPct >= MAX_SELL_TAX_PCT) {
      return { checked: true, isHoneypot: true, sellTaxPct, buyTaxPct, reason: `punitive sell tax ${sellTaxPct}%` };
    }
    return { checked: true, isHoneypot: false, sellTaxPct, buyTaxPct };
  }
  // No clear verdict / simulation didn't succeed → unverified (fail-open).
  return { checked: false, isHoneypot: false, reason: "simulation inconclusive" };
}

/** Live pre-buy honeypot check via honeypot.is for a BSC token. Never throws. */
export async function checkHoneypot(tokenAddress: string, chainId = 56): Promise<HoneypotResult> {
  if (!tokenAddress?.startsWith("0x")) return { checked: false, isHoneypot: false };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url = `${HONEYPOT_API}?address=${tokenAddress}&chainID=${chainId}`;
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    if (!res.ok) return { checked: false, isHoneypot: false, reason: `HTTP ${res.status}` };
    return parseHoneypot(await res.json());
  } catch (e) {
    return { checked: false, isHoneypot: false, reason: (e as Error).message };
  } finally {
    clearTimeout(timer);
  }
}
