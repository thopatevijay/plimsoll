import { describe, expect, it } from "vitest";
import {
  buildGetConstitutionArgs,
  buildSetConstitutionArgs,
  constitutionHash,
  sha256Hex,
} from "../src/identity/constitution.js";

describe("constitution commitment (G2)", () => {
  it("hashes deterministically as 0x + 64 hex", () => {
    const a = sha256Hex("hello");
    expect(a).toBe(sha256Hex("hello"));
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(sha256Hex("hello")).not.toBe(sha256Hex("world"));
  });

  it("hashes the real constitution.json to a valid commitment", () => {
    expect(constitutionHash()).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("builds the erc8004 set/get-metadata commands", () => {
    expect(buildSetConstitutionArgs("42", "0xabc")).toEqual([
      "erc8004", "set-metadata", "42", "--key", "constitution", "--value", "0xabc", "--chain", "bsc", "--json",
    ]);
    expect(buildGetConstitutionArgs("42")).toEqual([
      "erc8004", "get-metadata", "42", "--key", "constitution", "--chain", "bsc", "--json",
    ]);
  });
});
