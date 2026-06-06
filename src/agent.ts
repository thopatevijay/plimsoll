import { config, loadConstitution } from "./config.js";
import { fetchSignalBundle } from "./signals/index.js";
import { propose } from "./brain/index.js";
import { evaluate } from "./kernel/index.js";
import { executeSwap } from "./exec/index.js";
import { append } from "./ledger/index.js";
import { emptyPortfolio } from "./portfolio/index.js";
import { loadPortfolioFromChain } from "./ops/state.js";
import { alert } from "./ops/heartbeat.js";
import { applyWeights, loadWeights } from "./learning/index.js";
import type { LedgerEntry, PortfolioState } from "./types.js";

// THE TRACER BULLET (Phase 1): the thinnest end-to-end pipe, proving the layers
// compose — signal → brain → kernel → exec → ledger. Each layer is a hollow stub
// today; we thicken them one at a time (Phases 2-4), re-running this loop after
// each to confirm the pipe still flows. Build the skeleton, prove it, then fill.

async function runOnce(asset: string): Promise<LedgerEntry> {
  const constitution = loadConstitution();

  // Restart-state: rebuild equity/positions from chain on every boot (never local
  // memory). Falls back to a stub if the wallet/CLI isn't reachable.
  let portfolio: PortfolioState;
  try {
    portfolio = await loadPortfolioFromChain();
    console.log(`[0/5] state    → equity $${portfolio.equityUsd.toFixed(2)} from chain (peak $${portfolio.peakEquityUsd.toFixed(2)})`);
  } catch (e) {
    portfolio = emptyPortfolio(1000);
    console.log(`[0/5] state    → chain read failed, using $1000 stub: ${(e as Error).message}`);
  }

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
    const mode = config.mode === "live" ? "LIVE execute" : "dry-run quote";
    console.log(`[4/5] exec     → TWAK swap (${mode})`);
    try {
      entry.exec = await executeSwap(decision.order);
      console.log(`        ${entry.exec.txHash}`);
    } catch (e) {
      console.log(`        exec failed (non-fatal): ${(e as Error).message}`);
    }
  } else {
    console.log(`        rejected: ${decision.reason}`);
    console.log(`[4/5] exec     → skipped (kernel rejected)`);
  }

  console.log(`[5/5] ledger   → appended`);
  append(entry);
  console.log(`\n✅ cycle complete — pipe flows end to end.`);
  return entry;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// The unattended live-week runner. One decision per interval over a watchlist;
// every cycle is wrapped so a single failure never stops the loop, and trades /
// errors / a periodic heartbeat are pushed to Telegram (no-op if unconfigured).
// The USER launches this in live mode (`npm run dev`); it trades autonomously.
async function runContinuous(): Promise<void> {
  const watchlist = (process.env.SENTINEL_WATCHLIST ?? "CAKE,BNB,ETH")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const intervalMs = Number(process.env.SENTINEL_INTERVAL_MS ?? 300_000); // 5 min
  await alert("info", `starting (mode=${config.mode}, ${watchlist.length} assets, ${Math.round(intervalMs / 1000)}s cadence)`);
  let i = 0;
  while (true) {
    const asset = watchlist[i % watchlist.length] ?? "CAKE";
    try {
      const entry = await runOnce(asset);
      if (entry.exec) await alert("info", `${config.mode}: ${entry.proposal.direction} ${asset} → ${entry.exec.txHash}`);
    } catch (e) {
      await alert("error", `cycle ${i} (${asset}) failed: ${(e as Error).message}`);
    }
    if (i % 12 === 0) await alert("info", `heartbeat — cycle ${i}, watching ${asset}`);
    i++;
    await sleep(intervalMs);
  }
}

// `npm run tracer` (single cycle) or `npm run dev` (continuous live-week runner).
const once = process.argv.includes("--once");
if (once) {
  runOnce("CAKE")
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("cycle failed:", e);
      process.exit(1);
    });
} else {
  runContinuous().catch((e) => {
    console.error("runner failed:", e);
    process.exit(1);
  });
}
