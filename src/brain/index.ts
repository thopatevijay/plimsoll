import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// zod/v4: the Anthropic structured-output helper is typed against zod v4's core.
// zod 3.25 ships both APIs side-by-side; the rest of the repo still uses v3 `zod`.
import { z } from "zod/v4";
import { config } from "../config.js";
import { detectRegime } from "../regime/index.js";
import { ruleProposer } from "./rules.js";
import { summarize } from "../signals/features.js";
import type { Proposal, SignalBundle } from "../types.js";

// BRAIN LAYER — the LLM proposes ONE decision; it NEVER sizes and NEVER signs.
// This is a single structured-output call, not an agent: Claude returns one
// schema-validated proposal object and the deterministic kernel does the rest.
// Provider lives only in this file (Claude, Opus 4.8) — swapping it is one edit.
// We use adaptive thinking: better regime/conviction reasoning, model-chosen depth.

const SYSTEM_PROMPT = `You are the analysis brain of an autonomous crypto trading agent on BNB Chain.
Given a market signal bundle, output ONE trade decision matching the required schema:
{ regime: "trending"|"chopping"|"risk_off", asset: string, direction: "buy"|"sell"|"hold", conviction: number(0..1), thesis: string }
The thesis MUST be falsifiable (state what must stay true for this to work).
The input includes 'features' (named signal buckets) and 'detectedRegime' (a deterministic hint) — weigh them, but you may disagree with the hint if the data warrants.
The bundle.cmc also carries broader market context: 'marketRsi' (market-cap-wide RSI), 'news' (recent headlines for the asset), 'narratives' (trending market narratives), and 'macroEvents' (imminent market-moving events). Use these to inform conviction and the thesis — e.g. lower conviction or stay flat ahead of a major macro event or on clearly bearish news; note the relevant signal in the thesis. Headlines are noisy: weight confirmed price/funding/technical signals over a single headline.
If the asset is flagged as a honeypot, never propose a buy.
In a risk-off regime the active sleeve is FLAT — do not propose a buy (the kernel hard-refuses risk-off longs); prefer hold, or sell to reduce exposure.
You do NOT decide position size and you do NOT execute — a deterministic risk kernel does that.`;

// Validate the model's output before it touches the rest of the system. Structured
// outputs already constrain the shape; we still clamp conviction to [0,1] (the API
// enforces type, not range) and keep this schema as the single source of truth.
const ProposalSchema = z.object({
  regime: z.enum(["trending", "chopping", "risk_off"]),
  asset: z.string().min(1),
  direction: z.enum(["buy", "sell", "hold"]),
  conviction: z.number(),
  thesis: z.string().min(1),
});

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

/** Strict validate + clamp conviction to [0,1]. Throws on invalid shape. */
export function validateProposal(obj: unknown): Proposal {
  const p = ProposalSchema.parse(obj);
  return { ...p, conviction: clamp01(p.conviction) };
}

/** Parse raw JSON text into a Proposal; any failure degrades to a safe hold so
 *  the loop survives malformed output. (Kept as a defensive helper / test seam;
 *  the live path uses the SDK's schema-validated parse below.) */
export function parseProposal(raw: string, fallbackAsset: string): Proposal {
  try {
    return validateProposal(JSON.parse(raw));
  } catch (e) {
    return {
      regime: "risk_off",
      asset: fallbackAsset,
      direction: "hold",
      conviction: 0,
      thesis: `[parse-failure] could not read a valid decision from the model: ${(e as Error).message}`,
    };
  }
}

// The brain reasons over the raw bundle PLUS named features and a deterministic
// regime hint, so the model isn't classifying regime from raw numbers alone.
// Learned confidence weights are applied downstream (agent loop) — see learning/.
export async function propose(bundle: SignalBundle): Promise<Proposal> {
  const features = summarize(bundle);
  const detectedRegime = detectRegime(bundle);

  // No key → deterministic rule proposer so the full pipeline (and the learning
  // loop) still runs and makes real decisions. Same fallback on any API failure.
  if (!config.llm.apiKey) return ruleProposer(bundle);

  try {
    const client = new Anthropic({ apiKey: config.llm.apiKey });
    const res = await client.messages.parse({
      model: config.llm.model,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      output_config: { format: zodOutputFormat(ProposalSchema) },
      messages: [{ role: "user", content: JSON.stringify({ bundle, features, detectedRegime }) }],
    });
    if (!res.parsed_output) return ruleProposer(bundle); // refusal / unparseable → conservative fallback
    return validateProposal(res.parsed_output); // re-validate + clamp; mismatch throws → caught below
  } catch {
    // Provider outage / rate-limit → deterministic rule engine instead of aborting.
    return ruleProposer(bundle);
  }
}
