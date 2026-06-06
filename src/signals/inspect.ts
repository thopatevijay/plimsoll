import { ruleProposer } from "../brain/rules.js";
import { detectRegime } from "../regime/index.js";
import { summarize } from "./features.js";
import { fetchSignalBundle } from "./index.js";

// `npm run signals [SYMBOL]` — fetch the live signal bundle and show what the
// agent would see and decide. A dev/demo tool to sanity-check the data path.

const asset = process.argv[2] ?? "CAKE";
const bundle = await fetchSignalBundle(asset);
const features = summarize(bundle);
const regime = detectRegime(bundle);
const proposal = ruleProposer(bundle);

console.log(`\n🔎 live signals for ${asset}  (${bundle.timestamp})\n`);
console.log("  raw cmc:", JSON.stringify(bundle.cmc));
console.log("  features:", JSON.stringify(features));
console.log(`  detected regime: ${regime}`);
console.log(`  rule proposer:   ${proposal.direction}` + (proposal.direction !== "hold" ? ` (conviction ${proposal.conviction})` : "") + `  — ${proposal.thesis}\n`);
