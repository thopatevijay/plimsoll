import OpenAI from "openai";
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
  const text = res.choices[0]?.message?.content ?? "{}";
  // TODO(P3): zod-validate the shape and clamp conviction; retry on malformed JSON.
  return JSON.parse(text) as Proposal;
}
