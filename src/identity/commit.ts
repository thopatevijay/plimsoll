import { buildSetConstitutionArgs, constitutionHash, verifyCommitment } from "./constitution.js";

// `npm run constitution`            → print the hash + the commands YOU run to commit it.
// `npm run constitution <agentId>`  → verify the on-chain commitment matches the local file.

const agentId = process.argv[2];
const hash = constitutionHash();

if (!agentId) {
  console.log(`\nConstitution hash: ${hash}\n`);
  console.log("Commit it on-chain (you run these — fund-moving, signs with your wallet):");
  console.log("  1) twak erc8004 register --uri https://github.com/thopatevijay/plimsoll --chain bsc");
  console.log("     → note the returned agentId");
  console.log(`  2) twak ${buildSetConstitutionArgs("<agentId>", hash).join(" ")}`);
  console.log("\nThen verify:  npm run constitution <agentId>\n");
} else {
  const r = await verifyCommitment(agentId);
  console.log(`\nlocal  : ${r.local}`);
  console.log(`on-chain: ${r.onChain}`);
  console.log(r.match ? "\n✅ MATCH — the agent's risk rules are verifiably committed on-chain.\n" : "\n❌ MISMATCH — recommit, or check the agentId.\n");
}
