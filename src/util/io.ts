import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Resolve a state filename to its on-disk path. On a headless host (Railway/VPS)
// the container filesystem is EPHEMERAL across deploys, so set PLIMSOLL_STATE_DIR
// to a mounted volume and the agent's persistent state (learned weights, drawdown
// peak, open positions, ledger, daily counters, snapshot) survives restarts. Unset
// (the dev default) → write next to the agent in the cwd, exactly as before.
export function statePath(name: string): string {
  const dir = process.env.PLIMSOLL_STATE_DIR;
  return dir && dir.trim() ? join(dir, name) : name;
}

// Atomic JSON write: write a temp file then rename (atomic on POSIX). A crash
// mid-write can never leave a truncated/empty file — which matters because
// loadWeights/loadPositions swallow parse errors and would otherwise silently
// reset all learned state + open trades to empty.
export function atomicWriteJson(path: string, data: unknown): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, path);
}
