// Public, verifiable on-chain references for PLIMSOLL (BSC mainnet). These are
// facts anyone can check on bscscan — safe to commit. Consumed by the live
// snapshot the dashboard renders. (Wallet/agentId/registry/txs come from the
// registration done in setup; see .dev-refs.md.)
export const REFS = {
  wallet: "0xB848C0315997B683F702fd877Ce220293CFda1e5",
  agentId: "129312",
  registry: "0x8004a169fb4a3325136eb29fa0ceb6d2e539a432", // canonical BNB ERC-8004
  registered: true,
  proof: {
    swapTx: "0x4b94b94b9172708fd45bd600203e515d5228703be047d064194ddb4f014d3559",
    registerTx: "0xcf4076c59355d685923a1a3c0d7301626258d515a50a6f12bb3481abab9390af",
    setMetadataTx: "0x01ebdb614ff922b46fac6a0856d9a5b5732d5790488c0838611cafa645d4ab60",
    competeTx: "0xa7d3f9bc6324b2d482b8d1fa4832d93cf85173b801d9bbd34cff7e58ab7a0367",
  },
  // Representative real-data backtest (`npm run backtest CAKE`, 329 daily candles,
  // hold-through-trend, net of the measured ~1.4% TWAK round-trip cost) — historical
  // evidence, not live state. Figures roll with the trailing window.
  backtest: {
    asset: "CAKE",
    candles: 329,
    buyHoldPct: -50.0,
    strategyPct: -3.9, // net of cost
    grossPct: -3.2, // pre-cost
    maxDdPct: 6.7,
    trades: 4, // round-trips over the whole window — low-churn
    winRatePct: 25,
  },
} as const;
