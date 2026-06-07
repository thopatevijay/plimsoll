import { detectRegime } from "../regime/index.js";
import { macd, rsi } from "../signals/indicators.js";
import type { Regime, SignalBundle } from "../types.js";
import type { BacktestStep } from "./index.js";

// Real-data backtest input: free Binance public klines (no key). Our eligible
// liquid tokens (CAKE, ETH, BNB, …) trade as <SYM>USDT here, so this gives a
// real OHLCV series to replay the strategy over — a genuine backtest, not synthetic.
//
// Honest caveat: free history has no Fear & Greed / funding rate. We compute RSI
// and MACD directly from the real closes, and proxy F&G from recent momentum
// (sentiment tracks recent returns). funding is left neutral (0). The regime is
// therefore real-price-driven; we label this clearly in the report.

const KLINES_URL = "https://api.binance.com/api/v3/klines";
const MACD_WARMUP = 35; // slow(26) + signal(9)
const FG_LOOKBACK = 14;

/** Daily close series for <SYMBOL>USDT, oldest→newest. Throws on network/HTTP error. */
export async function fetchDailyCloses(symbol: string, days: number): Promise<number[]> {
  const url = `${KLINES_URL}?symbol=${symbol.toUpperCase()}USDT&interval=1d&limit=${days}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Binance klines ${symbol} → HTTP ${res.status}`);
  const rows = (await res.json()) as unknown[];
  if (!Array.isArray(rows)) throw new Error(`Binance klines ${symbol}: unexpected payload`);
  // kline tuple: [openTime, open, high, low, close, volume, ...] — close is index 4.
  return rows.map((r: any) => Number(r?.[4])).filter((n) => Number.isFinite(n) && n > 0);
}

/** Pure: momentum proxy for Fear & Greed (no free historical F&G). Maps the recent
 *  `lookback`-day return to a 0–100 score around 50. +ve momentum → greed, −ve → fear. */
export function proxyFearGreed(closes: number[], t: number, lookback = FG_LOOKBACK, k = 150): number {
  const prev = closes[t - lookback];
  const cur = closes[t];
  if (prev === undefined || cur === undefined || prev <= 0) return 50;
  const r = (cur - prev) / prev;
  return Math.max(0, Math.min(100, 50 + r * k));
}

/** Pure: turn a real close series into backtest steps. Each step's bundle carries
 *  real RSI/MACD + a momentum-proxied F&G; returnPctNext is the real next-day move;
 *  thesisHeld = the regime persisted into the next step. */
export function buildRealSteps(closes: number[], asset: string): BacktestStep[] {
  const start = Math.max(MACD_WARMUP, FG_LOOKBACK);
  if (closes.length < start + 2) return [];

  // Pass 1: per-day bundle + regime.
  const rows: { bundle: SignalBundle; regime: Regime }[] = [];
  for (let t = start; t < closes.length; t++) {
    const window = closes.slice(0, t + 1);
    const m = macd(window);
    const bundle: SignalBundle = {
      timestamp: `day-${t}`,
      asset,
      cmc: {
        priceUsd: closes[t],
        fearGreed: proxyFearGreed(closes, t),
        fundingRate: 0, // no free historical funding — neutral
        rsi: rsi(window, 14),
        macd: m?.macd,
      },
      chain: {},
    };
    rows.push({ bundle, regime: detectRegime(bundle) });
  }

  // Pass 2: steps with the real next-day return + regime-persistence thesis.
  const steps: BacktestStep[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const t = start + i;
    const cur = closes[t];
    const next = closes[t + 1];
    if (cur === undefined || next === undefined || cur <= 0) continue;
    steps.push({
      bundle: rows[i]!.bundle,
      returnPctNext: (next - cur) / cur,
      thesisHeld: rows[i]!.regime === rows[i + 1]!.regime,
    });
  }
  return steps;
}

/** Buy-and-hold return (%) over the same window — the honest benchmark. */
export function buyHoldReturnPct(closes: number[]): number {
  const start = Math.max(MACD_WARMUP, FG_LOOKBACK);
  const first = closes[start];
  const last = closes[closes.length - 1];
  if (first === undefined || last === undefined || first <= 0) return 0;
  return ((last - first) / first) * 100;
}
