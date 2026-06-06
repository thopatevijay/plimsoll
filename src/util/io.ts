import { renameSync, writeFileSync } from "node:fs";

// Atomic JSON write: write a temp file then rename (atomic on POSIX). A crash
// mid-write can never leave a truncated/empty file — which matters because
// loadWeights/loadPositions swallow parse errors and would otherwise silently
// reset all learned state + open trades to empty.
export function atomicWriteJson(path: string, data: unknown): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, path);
}
