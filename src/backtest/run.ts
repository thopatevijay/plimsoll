import { loadConstitution } from "../config.js";
import { getRegimeWeight } from "../learning/index.js";
import type { SignalBundle } from "../types.js";
import { runBacktest, type BacktestStep } from "./index.js";
import { buildRealSteps, buyHoldReturnPct, fetchDailyCloses } from "./binance.js";

// `npm run backtest [SYMBOL] [DAYS]` — replays the FULL strategy loop (regime →
// proposer → learned weights → risk kernel → sized fill → realized P&L → learning)
// over REAL daily price history from free Binance klines. Falls back to a small
// synthetic scenario if the network is unavailable (keyless, deterministic).

const START_EQUITY = 1000;

function report(title: string, r: ReturnType<typeof runBacktest>, extra: () => void) {
  const ret = ((r.finalEquityUsd - r.startEquityUsd) / r.startEquityUsd) * 100;
  console.log(`\n📊 ${title}\n`);
  extra();
  console.log(`  trades:         ${r.trades}  (win rate ${r.trades ? Math.round((r.wins / r.trades) * 100) : 0}%)`);
  console.log(`  equity:         $${r.startEquityUsd} → $${r.finalEquityUsd.toFixed(2)}  (${ret >= 0 ? "+" : ""}${ret.toFixed(1)}%)`);
  console.log(`  peak equity:    $${r.peakEquityUsd.toFixed(2)}`);
  console.log(`  max drawdown:   ${r.maxDrawdownPct.toFixed(1)}%  (DQ line ~30%)`);
  console.log("\n  learned regime weights (started at 1.00):");
  console.log(`    trending:  ${getRegimeWeight(r.weights, "trending").toFixed(2)}`);
  console.log(`    chopping:  ${getRegimeWeight(r.weights, "chopping").toFixed(2)}`);
  console.log(`    risk_off:  ${getRegimeWeight(r.weights, "risk_off").toFixed(2)}\n`);
}

const symbol = (process.argv[2] ?? "CAKE").toUpperCase();
const days = Number(process.argv[3] ?? 365);
const c = loadConstitution();

try {
  const closes = await fetchDailyCloses(symbol, days);
  const steps = buildRealSteps(closes, symbol);
  if (steps.length < 30) throw new Error(`too few candles for ${symbol} (${steps.length})`);
  const r = runBacktest(steps, c, START_EQUITY);
  const bh = buyHoldReturnPct(closes);
  report(`PLIMSOLL backtest — ${symbol}/USDT, ${steps.length} real daily candles (Binance)`, r, () => {
    console.log(`  benchmark:      buy & hold ${symbol} = ${bh >= 0 ? "+" : ""}${bh.toFixed(1)}% over the window`);
    console.log("  note:           RSI/MACD from real closes; F&G proxied from momentum, funding neutral (no free history)");
  });
} catch (e) {
  console.warn(`\n⚠️  Real backtest unavailable (${(e as Error).message}). Falling back to synthetic scenario.`);
  const mk = (cmc: SignalBundle["cmc"]): SignalBundle => ({ timestamp: "synthetic", asset: "CAKE", cmc, chain: {} });
  const TREND = mk({ fearGreed: 65, fundingRate: 0.02, macd: 1, rsi: 55 });
  const RISK_OFF = mk({ fearGreed: 14 });
  const synth = (n: number, bundle: SignalBundle, pnlUsd: number, thesisHeld: boolean): BacktestStep[] =>
    Array.from({ length: n }, () => ({ bundle, pnlUsd, thesisHeld }));
  const scenario: BacktestStep[] = [
    ...synth(6, TREND, 22, true),
    ...synth(3, TREND, -28, false),
    ...synth(3, RISK_OFF, 0, true),
    ...synth(4, TREND, 18, true),
  ];
  const r = runBacktest(scenario, c, START_EQUITY);
  report("PLIMSOLL backtest (synthetic, keyless)", r, () => {
    console.log(`  days:           ${scenario.length}  (risk-off days correctly skipped)`);
  });
}
