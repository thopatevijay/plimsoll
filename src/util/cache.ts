// Tiny in-process async cache. Two jobs:
//  • cachedTTL: memoize a value for a TTL window — for market-WIDE signals that are
//    identical across assets and barely move minute-to-minute (funding, Fear&Greed,
//    narratives, macro events, market-RSI). Re-fetching them every cycle/asset is
//    what burns the CMC credit budget; a 30-min window cuts that ~10x.
//  • cachedForever: memoize a value that never changes (symbol → CMC id resolution).
// On a fetch error the stale value (if any) is returned rather than throwing, so a
// transient CMC blip never blanks the signal feed.

interface Entry<T> {
  value: T;
  at: number; // epoch ms when stored
}

const store = new Map<string, Entry<unknown>>();

/** Memoize `fn`'s result under `key` for `ttlMs`. `nowMs` is injectable for tests. */
export async function cachedTTL<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  nowMs: number = Date.now(),
): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && nowMs - hit.at < ttlMs) return hit.value;
  try {
    const value = await fn();
    store.set(key, { value, at: nowMs });
    return value;
  } catch (e) {
    if (hit) return hit.value; // serve stale rather than fail the cycle
    throw e;
  }
}

/** Memoize forever (process lifetime) — for values that never change. */
export async function cachedForever<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit) return hit.value;
  const value = await fn();
  store.set(key, { value, at: 0 });
  return value;
}

/** Test-only: clear the cache between cases. */
export function _clearCache(): void {
  store.clear();
}
