// The agent-state snapshot the dashboard renders. The live agent emits this each
// cycle (see scripts/snapshot in the agent); the dashboard reads a live file if
// present, else the bundled sample — so it's stunning out of the box and on Vercel.

export type Regime = "trending" | "chopping" | "risk_off";
export type Direction = "buy" | "sell" | "hold";

export interface Snapshot {
  agent: {
    name: string;
    mode: "live" | "dev";
    wallet: string;
    agentId: string;
    registry: string;
    constitutionHash: string;
    registered: boolean;
  };
  asOf: string;
  cycle: number;
  latestDecision: {
    asset: string;
    regime: Regime;
    direction: Direction;
    conviction: number; // 0..1
    thesis: string;
    sizeUsd: number;
    approved: boolean;
    kernelReason: string;
  };
  signals: {
    cmc: {
      priceUsd?: number;
      fearGreed?: number;
      fundingRate?: number;
      rsi?: number;
      macd?: number;
      marketRsi?: number;
      news?: string[];
      narratives?: string[];
      macroEvents?: string[];
    };
    chain: {
      liquidityUsd?: number;
      dexImbalance?: number;
      walletFlow?: number;
      isHoneypot?: boolean;
    };
  };
  portfolio: {
    equityUsd: number;
    peakEquityUsd: number;
    drawdownPct: number;
    equityCurve: { t: string; equity: number }[];
  };
  learning: Record<Regime, number>;
  guardrails: {
    allowlist: number;
    perTradePct: number;
    dailyPct: number;
    slippageBps: number;
    liquidityFloorUsd: number;
    killSwitchPct: number;
    dqPct: number;
    honeypotGate: boolean;
  };
  ledger: {
    ts: string;
    asset: string;
    regime: Regime;
    direction: Direction;
    conviction: number;
    approved: boolean;
    note: string;
  }[];
  backtest: {
    asset: string;
    candles: number;
    buyHoldPct: number;
    strategyPct: number; // net of the simulated tx-cost model
    grossPct: number; // pre-cost, for the honest gross-vs-net comparison
    maxDdPct: number;
    trades: number; // completed round-trips (low-churn: hold-through-trend)
    winRatePct: number;
  };
  proof: {
    swapTx: string;
    registerTx: string;
    setMetadataTx: string;
    competeTx: string;
  };
}
