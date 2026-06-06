import { loadConstitution } from "../config.js";
import { getRegimeWeight } from "../learning/index.js";
import type { SignalBundle } from "../types.js";
import { runBacktest, type BacktestStep } from "./index.js";

// `npm run backtest` — a small synthetic scenario that shows the full loop +
// the learning adapting. Not a substitute for a real backtest on CMC history
// (Phase 7); it's a keyless, deterministic demo of the mechanism.

const mk = (cmc: SignalBundle["cmc"]): SignalBundle => ({
  timestamp: "2026-06-22T00:00:00.000Z",
  asset: "CAKE",
  cmc,
  chain: {},
});

const TREND = mk({ fearGreed: 65, fundingRate: 0.02, macd: 1, rsi: 55 });
const RISK_OFF = mk({ fearGreed: 14 });

const days = (n: number, bundle: SignalBundle, pnlUsd: number, thesisHeld: boolean): BacktestStep[] =>
  Array.from({ length: n }, () => ({ bundle, pnlUsd, thesisHeld }));

// 6 winning trend days → 3 losing trend days → 3 risk-off (no trade) → 4 winning trend days
const scenario: BacktestStep[] = [
  ...days(6, TREND, 22, true),
  ...days(3, TREND, -28, false),
  ...days(3, RISK_OFF, 0, true),
  ...days(4, TREND, 18, true),
];

const r = runBacktest(scenario, loadConstitution(), 1000);

console.log("\n📊 SENTINEL backtest (synthetic, keyless)\n");
console.log(`  days:           ${scenario.length}`);
console.log(`  trades:         ${r.trades}  (risk-off days correctly skipped)`);
console.log(`  equity:         $${r.startEquityUsd} → $${r.finalEquityUsd.toFixed(2)}`);
console.log(`  peak equity:    $${r.peakEquityUsd.toFixed(2)}`);
console.log(`  max drawdown:   ${r.maxDrawdownPct.toFixed(1)}%`);
console.log("\n  learned regime weights (started at 1.00):");
console.log(`    trending:  ${getRegimeWeight(r.weights, "trending").toFixed(2)}`);
console.log(`    chopping:  ${getRegimeWeight(r.weights, "chopping").toFixed(2)}`);
console.log(`    risk_off:  ${getRegimeWeight(r.weights, "risk_off").toFixed(2)}`);
console.log("\n  → the agent adjusted its trending conviction from its own track record.\n");
