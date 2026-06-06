import { loadConstitution } from "./config.js";
import { fetchSignalBundle } from "./signals/index.js";
import { propose } from "./brain/index.js";
import { evaluate } from "./kernel/index.js";
import { executeSwap } from "./exec/index.js";
import { append } from "./ledger/index.js";
import { emptyPortfolio } from "./portfolio/index.js";
import { applyWeights, loadWeights } from "./learning/index.js";
import type { LedgerEntry } from "./types.js";

// THE TRACER BULLET (Phase 1): the thinnest end-to-end pipe, proving the layers
// compose — signal → brain → kernel → exec → ledger. Each layer is a hollow stub
// today; we thicken them one at a time (Phases 2-4), re-running this loop after
// each to confirm the pipe still flows. Build the skeleton, prove it, then fill.

async function runOnce(asset: string): Promise<void> {
  const constitution = loadConstitution();

  // Phase 5 reads this from chain on every boot (never local memory). Stub for now.
  const portfolio = emptyPortfolio(1000);

  console.log(`\n[1/5] signals  → fetching bundle for ${asset}`);
  const bundle = await fetchSignalBundle(asset);

  console.log(`[2/5] brain    → proposing (LLM)`);
  const weights = loadWeights(); // learned from past outcomes; compounds across restarts
  const raw = await propose(bundle);
  const proposal = applyWeights(raw, weights); // past performance scales conviction
  console.log(
    `        regime=${proposal.regime} dir=${proposal.direction} conv=${raw.conviction}→${proposal.conviction.toFixed(2)} (learned)`,
  );

  console.log(`[3/5] kernel   → evaluating against constitution`);
  const decision = evaluate(proposal, portfolio, constitution);

  const entry: LedgerEntry = { ts: new Date().toISOString(), bundle, proposal, decision };

  if (decision.ok) {
    console.log(`        approved: ${decision.order.direction} $${decision.order.sizeUsd.toFixed(2)} ${decision.order.asset}`);
    console.log(`[4/5] exec     → TWAK swap (tracer: no real tx)`);
    entry.exec = await executeSwap(decision.order);
    console.log(`        tx=${entry.exec.txHash}`);
  } else {
    console.log(`        rejected: ${decision.reason}`);
    console.log(`[4/5] exec     → skipped (kernel rejected)`);
  }

  console.log(`[5/5] ledger   → appended`);
  append(entry);
  console.log(`\n✅ tracer bullet complete — pipe flows end to end.`);
}

// `npm run tracer`  or  `tsx src/agent.ts --once`
const once = process.argv.includes("--once");
if (once) {
  runOnce("CAKE").catch((e) => {
    console.error("tracer failed:", e);
    process.exit(1);
  });
} else {
  // Phase 5: the continuous autonomous loop + qualifier cron live here.
  console.log("Continuous mode not built yet. Run `npm run tracer` for the Phase 1 pipe.");
}
