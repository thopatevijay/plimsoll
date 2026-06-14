import fs from "node:fs";
import path from "node:path";
import type { Snapshot } from "./types";
import sample from "../data/sample-snapshot.json";

// Server-side: prefer a live snapshot the running agent emits (PLIMSOLL_SNAPSHOT,
// or ../snapshot.json next to the agent), else fall back to the bundled sample so
// the dashboard is stunning out of the box and deploys to Vercel with no agent.
export function loadSnapshot(): { snap: Snapshot; live: boolean } {
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
