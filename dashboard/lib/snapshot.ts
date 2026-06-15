import fs from "node:fs";
import path from "node:path";
import type { Snapshot } from "./types";
import sample from "../data/sample-snapshot.json";

// Resolve the agent snapshot, in priority order:
//   1. PLIMSOLL_SNAPSHOT_URL — the agent's live HTTP endpoint (Railway). This is how
//      the Vercel-hosted dashboard shows REAL live state across hosts.
//   2. A local snapshot.json next to a co-hosted agent (PLIMSOLL_SNAPSHOT or ../).
//   3. The bundled sample — so the dashboard is still stunning with no agent.
export async function loadSnapshot(): Promise<{ snap: Snapshot; live: boolean }> {
  const url = process.env.PLIMSOLL_SNAPSHOT_URL;
  if (url) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return { snap: (await res.json()) as Snapshot, live: true };
    } catch {
      /* agent unreachable → fall through */
    }
  }

  const p = process.env.PLIMSOLL_SNAPSHOT || path.join(process.cwd(), "..", "snapshot.json");
  try {
    if (fs.existsSync(p)) {
      return { snap: JSON.parse(fs.readFileSync(p, "utf8")) as Snapshot, live: true };
    }
  } catch {
    /* fall through to the bundled sample */
  }
  return { snap: sample as Snapshot, live: false };
}
