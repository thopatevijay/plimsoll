import { loadSnapshot } from "@/lib/snapshot";
import { Console } from "@/components/Console";

// Re-fetch the agent's live snapshot on every request: PLIMSOLL_SNAPSHOT_URL (the
// agent's Railway HTTP endpoint) when set, else a co-hosted file, else the bundled
// sample. force-dynamic so it's never statically cached.
export const dynamic = "force-dynamic";

export default async function Page() {
  const { snap, live } = await loadSnapshot();
  return <Console snap={snap} live={live} />;
}
