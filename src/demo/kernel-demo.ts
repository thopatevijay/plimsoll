import { loadConstitution } from "../config.js";
import { evaluate } from "../kernel/index.js";
import { MIN_LIQUIDITY_USD } from "../kernel/index.js";
import type { PortfolioState, Proposal } from "../types.js";

// DEMO ONLY — visualize the risk kernel as a pure function: same agent code that
// guards every live trade, run on a few crafted proposals so a veto is visible on
// camera regardless of the current market regime. Nothing here touches the chain.

const c = loadConstitution();
const equity = 1000;
const healthy: PortfolioState = {
  equityUsd: equity,
  peakEquityUsd: equity,
  positions: { CAKE: 200 },
  tradesToday: 0,
  tradeVolumeTodayUsd: 0,
};
const drawn: PortfolioState = { ...healthy, equityUsd: 780, peakEquityUsd: 1000 }; // 22% dd

const buy = (asset: string, conviction = 0.8): Proposal => ({
  regime: "trending",
  asset,
  direction: "buy",
  conviction,
  thesis: "demo",
});

const cases: { label: string; proposal: Proposal; portfolio: PortfolioState; safety?: Parameters<typeof evaluate>[3] }[] = [
  { label: "Approve a confirmed trending buy (CAKE)", proposal: buy("CAKE"), portfolio: healthy, safety: { regime: "trending", liquidityUsd: 13_300_000, isHoneypot: false } },
  { label: "VETO — asset not in the 148-token allowlist (FOO)", proposal: buy("FOO"), portfolio: healthy },
  { label: "VETO — DEX liquidity below the $50k floor", proposal: buy("CAKE"), portfolio: healthy, safety: { liquidityUsd: 21_000 } },
  { label: "VETO — pre-buy honeypot gate", proposal: buy("CAKE"), portfolio: healthy, safety: { isHoneypot: true } },
  { label: "VETO — drawdown past the 20% kill-switch (equity 780/1000)", proposal: buy("CAKE"), portfolio: drawn },
  { label: "FORCE-FLATTEN — risk-off sells the held position (survival)", proposal: buy("CAKE"), portfolio: healthy, safety: { regime: "risk_off" } },
];

console.log(`\n  PLIMSOLL risk kernel — the deterministic gate (liquidity floor $${MIN_LIQUIDITY_USD.toLocaleString()}, kill-switch ${c.risk.hardDrawdownPct}%)\n`);
for (const { label, proposal, portfolio, safety } of cases) {
  const d = evaluate(proposal, portfolio, c, safety ?? {});
  if (d.ok) {
    console.log(`  ✅ APPROVE  ${label}`);
    console.log(`             → ${d.order.direction} $${d.order.sizeUsd.toFixed(2)} ${d.order.asset} @ ${d.order.maxSlippageBps}bps\n`);
  } else {
    console.log(`  ⛔ REJECT   ${label}`);
    console.log(`             → ${d.reason}\n`);
  }
}
console.log("  The LLM only proposes. None of these vetoes can be argued past — it's a pure function.\n");
