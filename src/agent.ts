import { config, loadConstitution } from "./config.js";
import { fetchSignalBundle } from "./signals/index.js";
import { propose } from "./brain/index.js";
import { evaluate } from "./kernel/index.js";
import { executeSwap } from "./exec/index.js";
import { append } from "./ledger/index.js";
import { detectRegime } from "./regime/index.js";
import { emptyPortfolio } from "./portfolio/index.js";
import { loadPortfolioFromChain } from "./ops/state.js";
import { alert } from "./ops/heartbeat.js";
import {
  computeOutcome,
  loadPositions,
  savePositions,
  type OpenPosition,
} from "./ops/positions.js";
import { applyWeights, learnFromOutcome, loadWeights, saveWeights } from "./learning/index.js";
import type { LedgerEntry, PortfolioState } from "./types.js";

/** Parse a positive-ish env number, falling back to default on NaN/garbage. */
function envNum(name: string, def: number, min: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= min ? n : def;
}

// How long a decision is held before we grade it (and learn). Configurable so a
// demo can set it short (e.g. 60000) and watch the agent adapt quickly.
const HOLD_MS = envNum("SENTINEL_HOLD_MS", 3_600_000, 0); // 1h default
// Hard cap so an open decision that's never re-priced can't grow positions.json
// forever (e.g. its asset was removed from the watchlist mid-week).
const MAX_POSITION_AGE_MS = Math.max(HOLD_MS * 6, 12 * 3_600_000);

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
    // NEVER trade on fabricated equity in live mode — skip the cycle instead.
    if (config.mode === "live") {
      throw new Error(`live chain read failed — skipping cycle (won't trade blind): ${(e as Error).message}`);
    }
    portfolio = emptyPortfolio(1000); // dev/dry-run only
    console.log(`[0/5] state    → chain read failed, using $1000 stub (dev): ${(e as Error).message}`);
  }

  console.log(`\n[1/5] signals  → fetching bundle for ${asset}`);
  const bundle = await fetchSignalBundle(asset);
  const currentRegime = detectRegime(bundle);
  const currentPrice = bundle.cmc.priceUsd;

  // Resolution pass: grade any matured decision on this asset and fold the result
  // into the learned weights (the live outcome→learning loop). Runs in dry-run too.
  let weights = loadWeights();
  const now = Date.now();
  const remaining: OpenPosition[] = [];
  for (const pos of loadPositions()) {
    const age = now - pos.openedAt;
    if (pos.asset === asset && currentPrice !== undefined && currentPrice > 0 && age >= HOLD_MS) {
      const outcome = computeOutcome(pos, currentPrice, currentRegime);
      const { weights: updated, grade } = learnFromOutcome(weights, pos.regime, outcome);
      weights = updated;
      append({
        ts: new Date().toISOString(),
        bundle,
        proposal: { regime: pos.regime, asset, direction: pos.direction, conviction: 0, thesis: pos.thesis },
        decision: { ok: false, reason: "resolved" },
        outcome,
        selfGrade: grade,
      });
      console.log(
        `[learn]  ${asset} ${pos.direction}: pnl $${outcome.pnlUsd.toFixed(2)}, thesis ${outcome.thesisHeld ? "held" : "broke"}, grade ${grade.toFixed(2)} → ${pos.regime} weight ${weights.byRegime[pos.regime].toFixed(2)}`,
      );
    } else if (age >= MAX_POSITION_AGE_MS) {
      // Never priced/revisited within the bound — drop it so the file can't grow forever.
      console.log(`[learn]  dropping stale ${pos.asset} ${pos.direction} (age ${Math.round(age / 3_600_000)}h, no price to grade)`);
    } else {
      remaining.push(pos);
    }
  }
  savePositions(remaining);
  saveWeights(weights);

  console.log(`[2/5] brain    → proposing (LLM)`);
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
      // Record the decision to be graded after the hold horizon (drives learning).
      if (currentPrice !== undefined && currentPrice > 0) {
        const open = loadPositions();
        open.push({
          id: entry.ts,
          asset,
          direction: decision.order.direction,
          entryPrice: currentPrice,
          sizeUsd: decision.order.sizeUsd,
          regime: proposal.regime,
          entryRegime: currentRegime,
          thesis: proposal.thesis,
          openedAt: now,
        });
        savePositions(open);
      }
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
  const intervalMs = envNum("SENTINEL_INTERVAL_MS", 300_000, 1000); // 5 min, min 1s
  await alert("info", `starting (mode=${config.mode}, ${watchlist.length} assets, ${Math.round(intervalMs / 1000)}s cadence)`);
  let i = 0;
  let consecutiveFailures = 0;
  while (true) {
    const asset = watchlist[i % watchlist.length] ?? "CAKE";
    let ok = true;
    try {
      const entry = await runOnce(asset);
      if (entry.exec) await alert("info", `${config.mode}: ${entry.proposal.direction} ${asset} → ${entry.exec.txHash}`);
    } catch (e) {
      ok = false;
      await alert("error", `cycle ${i} (${asset}) failed: ${(e as Error).message}`);
    }
    if (i % 12 === 0) await alert("info", `heartbeat — cycle ${i}, watching ${asset}`);
    i++;
    // Exponential backoff on sustained failure (capped 32×) so a prolonged API
    // outage doesn't hammer endpoints every interval. Resets on a clean cycle.
    consecutiveFailures = ok ? 0 : Math.min(consecutiveFailures + 1, 5);
    await sleep(intervalMs * 2 ** consecutiveFailures);
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
