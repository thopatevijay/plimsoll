// Pure technical indicators from a close-price series. We compute these
// ourselves from CMC OHLCV rather than depend on the (unconfirmed) TA REST
// endpoint — and pure functions are unit-testable + deterministic. Each returns
// undefined when given too little data, so the bundle field simply stays unset.

/** Exponential moving average series, seeded with the SMA of the first `period`. */
export function ema(values: number[], period: number): number[] {
  if (period <= 0 || values.length < period) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(prev);
  for (let i = period; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

/** Wilder's RSI over `period` (latest value). 100 = only gains, 0 = only losses. */
export function rsi(closes: number[], period = 14): number | undefined {
  if (closes.length < period + 1) return undefined;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i]! - closes[i - 1]!;
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i]! - closes[i - 1]!;
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** MACD line / signal / histogram (latest values). */
export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): { macd: number; signal: number; histogram: number } | undefined {
  if (closes.length < slow + signalPeriod) return undefined;
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const offset = emaFast.length - emaSlow.length; // fast series is longer
  const macdLine = emaSlow.map((s, i) => emaFast[i + offset]! - s);
  const signalArr = ema(macdLine, signalPeriod);
  if (signalArr.length === 0) return undefined;
  const macdVal = macdLine[macdLine.length - 1]!;
  const signalVal = signalArr[signalArr.length - 1]!;
  return { macd: macdVal, signal: signalVal, histogram: macdVal - signalVal };
}
