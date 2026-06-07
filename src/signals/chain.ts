import { createPublicClient, http, parseAbi, zeroAddress } from "viem";
import { bsc } from "viem/chains";
import { config } from "../config.js";

// Chain-native DEX signal, read DIRECTLY from the PancakeSwap V2 pair via RPC —
// ground-truth reserves, not a noisy aggregate API. Its job is a SAFETY GATE:
// refuse to trade tokens whose on-chain DEX liquidity is too thin (slippage /
// rug risk). This is "reads the chain natively" backing the strategy with real
// protection for real capital.

const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const PANCAKE_V2_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";

const FACTORY_ABI = parseAbi(["function getPair(address,address) view returns (address)"]);
const PAIR_ABI = parseAbi([
  "function getReserves() view returns (uint112,uint112,uint32)",
  "function token0() view returns (address)",
]);

/** Pure: USD value of a token/WBNB pool ≈ 2 × WBNB-side reserve × BNB price. */
export function computeLiquidityUsd(wbnbReserveRaw: bigint, bnbPriceUsd: number): number {
  return (Number(wbnbReserveRaw) / 1e18) * bnbPriceUsd * 2;
}

let client: ReturnType<typeof createPublicClient> | undefined;
function rpc() {
  if (!client) client = createPublicClient({ chain: bsc, transport: http(config.bsc.rpcUrl) });
  return client;
}

/** On-chain DEX liquidity (USD) for a token's WBNB pair. undefined if there's no
 *  WBNB pair or it can't be read (caller treats undefined as "unverified"). */
export async function fetchDexLiquidityUsd(
  tokenAddress: string,
  bnbPriceUsd: number,
): Promise<number | undefined> {
  if (!tokenAddress.startsWith("0x") || tokenAddress.toLowerCase() === WBNB.toLowerCase()) return undefined;
  if (!Number.isFinite(bnbPriceUsd) || bnbPriceUsd <= 0) return undefined;
  try {
    const token = tokenAddress as `0x${string}`;
    const pair = (await rpc().readContract({
      address: PANCAKE_V2_FACTORY,
      abi: FACTORY_ABI,
      functionName: "getPair",
      args: [token, WBNB],
    })) as `0x${string}`;
    if (!pair || pair === zeroAddress) return undefined;

    const [reserves, token0] = await Promise.all([
      rpc().readContract({ address: pair, abi: PAIR_ABI, functionName: "getReserves" }) as Promise<readonly [bigint, bigint, number]>,
      rpc().readContract({ address: pair, abi: PAIR_ABI, functionName: "token0" }) as Promise<`0x${string}`>,
    ]);
    const wbnbReserve = token0.toLowerCase() === WBNB.toLowerCase() ? reserves[0] : reserves[1];
    return computeLiquidityUsd(wbnbReserve, bnbPriceUsd);
  } catch {
    return undefined; // RPC hiccup → unverified, never crash the cycle
  }
}
