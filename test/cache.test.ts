import { beforeEach, describe, expect, it } from "vitest";
import { _clearCache, cachedForever, cachedTTL } from "../src/util/cache.js";

beforeEach(() => _clearCache());

describe("cachedTTL", () => {
  it("calls fn once within the TTL window, re-uses the value", async () => {
    let calls = 0;
    const fn = async () => ++calls;
    expect(await cachedTTL("k", 1000, fn, 0)).toBe(1);
    expect(await cachedTTL("k", 1000, fn, 500)).toBe(1); // within TTL → cached
    expect(calls).toBe(1);
  });

  it("re-fetches after the TTL expires", async () => {
    let calls = 0;
    const fn = async () => ++calls;
    expect(await cachedTTL("k", 1000, fn, 0)).toBe(1);
    expect(await cachedTTL("k", 1000, fn, 1500)).toBe(2); // past TTL → refetch
    expect(calls).toBe(2);
  });

  it("serves a stale value when the refetch throws (never blanks the feed)", async () => {
    let mode: "ok" | "fail" = "ok";
    const fn = async () => {
      if (mode === "fail") throw new Error("CMC 429");
      return "fresh";
    };
    expect(await cachedTTL("k", 100, fn, 0)).toBe("fresh");
    mode = "fail";
    expect(await cachedTTL("k", 100, fn, 200)).toBe("fresh"); // stale served, no throw
  });

  it("throws if the first fetch fails with nothing cached", async () => {
    await expect(cachedTTL("k", 100, async () => { throw new Error("boom"); }, 0)).rejects.toThrow("boom");
  });

  it("keys are independent", async () => {
    expect(await cachedTTL("a", 1000, async () => 1, 0)).toBe(1);
    expect(await cachedTTL("b", 1000, async () => 2, 0)).toBe(2);
  });
});

describe("cachedForever", () => {
  it("calls fn exactly once, ever", async () => {
    let calls = 0;
    const fn = async () => ++calls;
    expect(await cachedForever("id", fn)).toBe(1);
    expect(await cachedForever("id", fn)).toBe(1);
    expect(await cachedForever("id", fn)).toBe(1);
    expect(calls).toBe(1);
  });
});
