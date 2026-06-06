import { describe, expect, it } from "vitest";
import { parseWalletPortfolio } from "../src/ops/state.js";

describe("restart-state: parseWalletPortfolio", () => {
  it("sums usdValue into equity and maps positions (live shape)", () => {
    const holdings = [
      { chain: "bsc", type: "native", symbol: "BNB", balance: "0.00336", usdValue: 1.93 },
      { chain: "bsc", type: "token", symbol: "USDC", balance: "1.4796", usdValue: 1.48 },
    ];
    const { equityUsd, positions } = parseWalletPortfolio(holdings);
    expect(equityUsd).toBeCloseTo(3.41);
    expect(positions.BNB).toBeCloseTo(1.93);
    expect(positions.USDC).toBeCloseTo(1.48);
  });

  it("handles empty / malformed input", () => {
    expect(parseWalletPortfolio([])).toEqual({ equityUsd: 0, positions: {} });
    expect(parseWalletPortfolio(null)).toEqual({ equityUsd: 0, positions: {} });
  });
});
