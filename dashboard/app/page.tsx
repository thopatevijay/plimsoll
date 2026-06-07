import { loadSnapshot } from "@/lib/snapshot";
import { Console } from "@/components/Console";

export default function Page() {
  const { snap, live } = loadSnapshot();
  return <Console snap={snap} live={live} />;
}
