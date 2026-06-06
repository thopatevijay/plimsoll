import { describe, expect, it } from "vitest";
import {
  buildAutomateQualifierArgs,
  buildCompeteRegisterArgs,
  buildSwapArgs,
  buildX402Args,
  swapTokensFor,
} from "../src/exec/twak.js";
import type { SizedOrder } from "../src/types.js";

const order = (direction: "buy" | "sell"): SizedOrder => ({
  asset: "CAKE",
  direction,
  sizeUsd: 90,
  maxSlippageBps: 100,
});

describe("twak command builders (v0.17.0 verified)", () => {
  it("builds a USD-sized BSC swap quote (slippage in %)", () => {
    const args = buildSwapArgs({ from: "USDC", to: "0xCAKE", usd: 90, slippageBps: 100, quoteOnly: true });
    expect(args).toEqual([
      "swap", "USDC", "0xCAKE", "--usd", "90", "--chain", "bsc", "--slippage", "1", "--json", "--quote-only",
    ]);
  });

  it("omits --quote-only for live execution", () => {
    expect(buildSwapArgs({ from: "USDC", to: "0xCAKE", usd: 90, slippageBps: 50 })).not.toContain("--quote-only");
  });

  it("maps buy/sell to from/to token ids", () => {
    expect(swapTokensFor(order("buy"), "USDC", "0xCAKE")).toEqual({ from: "USDC", to: "0xCAKE" });
    expect(swapTokensFor(order("sell"), "USDC", "0xCAKE")).toEqual({ from: "0xCAKE", to: "USDC" });
  });

  it("builds an x402 request that pays via twak (R1)", () => {
    const url = "https://pro-api.coinmarketcap.com/x402/v3/cryptocurrency/quotes/latest";
    expect(buildX402Args(url, "10000000000000000")).toEqual([
      "x402", "request", url, "--max-payment", "10000000000000000", "--yes", "--json",
    ]);
  });

  it("builds the on-chain competition registration", () => {
    expect(buildCompeteRegisterArgs()).toEqual(["compete", "register", "--json"]);
  });

  it("builds the daily-qualifier automate DCA job (R2)", () => {
    const args = buildAutomateQualifierArgs({ from: "USDC", to: "0xCAKE", amount: 5 });
    expect(args).toContain("automate");
    expect(args).toContain("--interval");
    expect(args[args.indexOf("--interval") + 1]).toBe("1d");
  });
});
