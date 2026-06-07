import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnTwak } from "../exec/index.js";

// G2 — on-chain constitution commitment. Hash the exact risk rules the agent
// runs, and commit that hash to the agent's ERC-8004 identity metadata. Anyone
// can then verify the agent published the rules it promised to follow. The hash
// + verification are deterministic/read-only (built here); the on-chain write is
// a fund-moving signing action the USER runs.

const __dirname = dirname(fileURLToPath(import.meta.url));
const METADATA_KEY = "constitution";

/** Pure: 0x-prefixed sha256 of the given content. */
export function sha256Hex(content: string): string {
  return `0x${createHash("sha256").update(content).digest("hex")}`;
}

/** Hash the exact committed constitution.json (raw bytes — unambiguous). */
export function constitutionHash(): string {
  return sha256Hex(readFileSync(join(__dirname, "..", "..", "constitution.json"), "utf8"));
}

export function buildSetConstitutionArgs(agentId: string, hash: string): string[] {
  return ["erc8004", "set-metadata", agentId, "--key", METADATA_KEY, "--value", hash, "--chain", "bsc", "--json"];
}

export function buildGetConstitutionArgs(agentId: string): string[] {
  return ["erc8004", "get-metadata", agentId, "--key", METADATA_KEY, "--chain", "bsc", "--json"];
}

const norm = (s: string): string => s.replace(/^0x/i, "").toLowerCase();

/** Read the committed hash back from chain and compare to the local file (read-only). */
export async function verifyCommitment(
  agentId: string,
): Promise<{ local: string; onChain: string; match: boolean }> {
  const local = constitutionHash();
  const res = await spawnTwak(buildGetConstitutionArgs(agentId));
  const onChain = String(res?.value ?? res?.metadata ?? res?.result ?? res?.data ?? "");
  return { local, onChain, match: onChain.length > 2 && norm(onChain) === norm(local) };
}
