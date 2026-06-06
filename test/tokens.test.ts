import { describe, expect, it } from "vitest";
import { parseBscAddress } from "../src/tokens/index.js";

// Fixture shape captured live from CMC /v2/cryptocurrency/info.
const cakeInfo = [
  {
    contract_address: [
      { contract_address: "0x152649eA73beAb28c5b49B26eb48f7EAD6d4c898", platform: { name: "Ethereum" } },
      { contract_address: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82", platform: { name: "BNB Smart Chain (BEP20)" } },
      { contract_address: "4qQeZ5LwSz6HuupUu8jCtgXyW1mYQcNbFAW1sWZp89HL", platform: { name: "Solana" } },
    ],
  },
];

describe("token registry", () => {
  it("picks the BEP-20 contract address from CMC info", () => {
    expect(parseBscAddress(cakeInfo)).toBe("0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82");
  });

  it("returns undefined when there is no BSC entry", () => {
    expect(parseBscAddress([{ contract_address: [{ contract_address: "0xabc", platform: { name: "Ethereum" } }] }])).toBeUndefined();
    expect(parseBscAddress([{}])).toBeUndefined();
    expect(parseBscAddress(undefined)).toBeUndefined();
  });
});
