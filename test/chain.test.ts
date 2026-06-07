import { describe, expect, it } from "vitest";
import { computeLiquidityUsd } from "../src/signals/chain.js";

describe("computeLiquidityUsd", () => {
  it("values a pool as 2× the WBNB-side reserve in USD", () => {
    // 10 WBNB (1e19 wei) at $600 → one side $6000 → pool ≈ $12000
    expect(computeLiquidityUsd(10n * 10n ** 18n, 600)).toBeCloseTo(12000);
  });

  it("scales with reserve and price", () => {
    expect(computeLiquidityUsd(10n ** 18n, 600)).toBeCloseTo(1200); // 1 WBNB
    expect(computeLiquidityUsd(0n, 600)).toBe(0);
  });
});
