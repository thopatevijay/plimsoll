import type { SignalBundle } from "../types.js";

// Compact, named features derived from the raw signal bundle. The LLM reasons
// better over "fearGreed: extreme_fear" than over a bare number, and these
// labels make the decision memo (and the thought-stream) readable. Pure.

export type FundingSign = "positive" | "negative" | "flat";
export type FgBucket = "extreme_fear" | "fear" | "neutral" | "greed" | "extreme_greed";
export type RsiZone = "oversold" | "neutral" | "overbought";

export function fundingSign(f: number | undefined): FundingSign {
  if (f === undefined || Math.abs(f) < 0.001) return "flat";
  return f > 0 ? "positive" : "negative";
}

export function fgBucket(fg: number | undefined): FgBucket {
  if (fg === undefined) return "neutral";
  if (fg <= 25) return "extreme_fear";
  if (fg <= 45) return "fear";
  if (fg < 55) return "neutral";
  if (fg < 75) return "greed";
  return "extreme_greed";
}

export function rsiZone(rsi: number | undefined): RsiZone {
  if (rsi === undefined) return "neutral";
  if (rsi <= 30) return "oversold";
  if (rsi >= 70) return "overbought";
  return "neutral";
}

export interface Features {
  funding: FundingSign;
  sentiment: FgBucket;
  rsi: RsiZone;
  honeypot: boolean;
}

export function summarize(b: SignalBundle): Features {
  return {
    funding: fundingSign(b.cmc.fundingRate),
    sentiment: fgBucket(b.cmc.fearGreed),
    rsi: rsiZone(b.cmc.rsi),
    honeypot: b.chain.isHoneypot ?? false,
  };
}
