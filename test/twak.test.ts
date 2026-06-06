import { describe, expect, it } from "vitest";
import {
  buildAutomateQualifierArgs,
  buildCompeteRegisterArgs,
  buildSwapArgs,
  buildX402Args,
} from "../src/exec/twak.js";
import type { SizedOrder } from "../src/types.js";

const order = (direction: "buy" | "sell"): SizedOrder => ({
  asset: "CAKE",
  direction,
  sizeUsd: 120,
  maxSlippageBps: 100,
});

describe("twak command builders", () => {
  it("builds a buy swap (stable → asset) on BSC with slippage in %", () => {
    const args = buildSwapArgs(order("buy"), { stable: "USDC" });
    expect(args).toEqual(["swap", "120", "USDC", "CAKE", "--chain", "bsc", "--slippage", "1"]);
  });

  it("builds a sell swap (asset → stable)", () => {
    const args = buildSwapArgs(order("sell"), { stable: "USDC" });
    expect(args.slice(1, 4)).toEqual(["120", "CAKE", "USDC"]);
  });

  it("builds an x402 request that pays via twak (R1)", () => {
    const args = buildX402Args("https://pro-api.coinmarketcap.com/x402/v3/cryptocurrency/quotes/latest", "10000");
    expect(args).toEqual([
      "x402", "request",
      "https://pro-api.coinmarketcap.com/x402/v3/cryptocurrency/quotes/latest",
      "--max-payment", "10000", "--yes",
    ]);
  });

  it("builds the on-chain competition registration", () => {
    expect(buildCompeteRegisterArgs()).toEqual(["compete", "register", "--json"]);
  });

  it("builds the daily-qualifier automate job (R2 — native autonomous mode)", () => {
    const args = buildAutomateQualifierArgs({ stable: "USDC", asset: "CAKE", amountUsd: 5 });
    expect(args).toContain("automate");
    expect(args).toContain("--interval");
    expect(args).toContain("1d");
  });
});
