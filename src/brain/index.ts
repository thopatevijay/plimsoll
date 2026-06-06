import OpenAI from "openai";
import { z } from "zod";
import { config } from "../config.js";
import type { Proposal, SignalBundle } from "../types.js";

// BRAIN LAYER — the LLM proposes a decision; it NEVER sizes and NEVER signs.
// Provider-agnostic by design: this is the only file that names a provider, so
// swapping OpenAI ↔ Anthropic later is a one-file change. We use OpenAI
// (gpt-4o-mini) — ~$0.38/week, negligible vs the value.

const SYSTEM_PROMPT = `You are the analysis brain of an autonomous crypto trading agent on BNB Chain.
Given a market signal bundle, output ONE trade decision as strict JSON:
{ "regime": "trending"|"chopping"|"risk_off", "asset": string, "direction": "buy"|"sell"|"hold", "conviction": number(0..1), "thesis": string }
The thesis MUST be falsifiable (state what must be true for this to work).
You do NOT decide position size and you do NOT execute — a deterministic risk kernel does that.`;

// Validate the model's JSON before it touches the rest of the system. A 24/7
// agent must never crash on a malformed LLM response, so parsing degrades to a
// safe "hold" rather than throwing.
const ProposalSchema = z.object({
  regime: z.enum(["trending", "chopping", "risk_off"]),
  asset: z.string().min(1),
  direction: z.enum(["buy", "sell", "hold"]),
  conviction: z.number(),
  thesis: z.string().min(1),
});

/** Strict validate + clamp conviction to [0,1]. Throws on invalid shape. */
export function validateProposal(obj: unknown): Proposal {
  const p = ProposalSchema.parse(obj);
  return { ...p, conviction: Math.max(0, Math.min(1, p.conviction)) };
}

/** Parse raw LLM text into a Proposal; any failure degrades to a safe hold so
 *  the loop survives malformed output. */
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

// Phase 3 makes this learn: per-regime/per-signal confidence weights (updated by
// the ledger's self-grade) get injected here so the next decision reflects past outcomes.
export async function propose(bundle: SignalBundle): Promise<Proposal> {
  if (!config.llm.apiKey) {
    // TRACER BULLET: deterministic stub so the pipe runs keyless.
    return {
      regime: "chopping",
      asset: bundle.asset,
      direction: "hold",
      conviction: 0.1,
      thesis: "[stub] no LLM key set; defaulting to hold until brain is wired.",
    };
  }

  const client = new OpenAI({ apiKey: config.llm.apiKey });
  const res = await client.chat.completions.create({
    model: config.llm.model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(bundle) },
    ],
  });
  return parseProposal(res.choices[0]?.message?.content ?? "{}", bundle.asset);
}
