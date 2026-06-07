import { loadSnapshot } from "@/lib/snapshot";
import { Console } from "@/components/Console";

// Re-read the agent's snapshot.json on every request (so a dashboard hosted next
// to the running agent shows live state). On Vercel there's no agent file → the
// loader falls back to the bundled sample.
export const dynamic = "force-dynamic";

export default function Page() {
  const { snap, live } = loadSnapshot();
  return <Console snap={snap} live={live} />;
}
