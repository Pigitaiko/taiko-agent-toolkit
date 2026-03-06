import {
  createPublicClient,
  http,
  encodeFunctionData,
  parseUnits,
  formatUnits,
  type Hash,
} from "viem";
import { SessionWallet } from "../wallet/session-wallet.js";
import { getChain, KNOWN_TOKENS, type SupportedChainId } from "../config/chains.js";

// Uniswap V2 Router-compatible ABI (works with most Taiko DEXes)
const ROUTER_ABI = [
  {
    name: "swapExactETHForTokens",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "swapExactTokensForETH",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "swapExactTokensForTokens",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "getAmountsOut",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

// TaikoSwap (UniswapV2 fork) — verified on-chain
// Router.factory() => 0x278e9cbe..., Router.WETH() => 0xA51894...
const TAIKOSWAP = {
  router: "0xF078BD74C62a2F643fd9630ECBCfe1C3c28f4734" as `0x${string}`,
  factory: "0x278e9cbe8839a8b634bb214b58207be3743195ac" as `0x${string}`,
};

const DEX_ROUTERS: Record<string, `0x${string}`> = {
  default: TAIKOSWAP.router,
  taikoswap: TAIKOSWAP.router,
};

export interface SwapParams {
  fromToken: string; // symbol or address
  toToken: string;
  amount: string;
  slippageBps?: number; // basis points, default 50 (0.5%)
  router?: string; // router name or address
}

export interface SwapQuote {
  fromToken: string;
  toToken: string;
  amountIn: string;
  estimatedAmountOut: string;
  slippageBps: number;
  minimumAmountOut: string;
  router: string;
}

export interface SwapResult {
  hash: Hash;
  explorerUrl: string;
  fromToken: string;
  toToken: string;
  amountIn: string;
}

function resolveTokenAddress(
  tokenOrSymbol: string,
  chainId: SupportedChainId
): { address: `0x${string}`; decimals: number; symbol: string } {
  const upper = tokenOrSymbol.toUpperCase();

  if (upper === "ETH") {
    // WETH for routing
    const weth = KNOWN_TOKENS["WETH"]?.find((t) => t.chainId === chainId);
    if (!weth) throw new Error("WETH not configured for this chain");
    return weth;
  }

  const known = KNOWN_TOKENS[upper]?.find((t) => t.chainId === chainId);
  if (known) return known;

  if (tokenOrSymbol.startsWith("0x") && tokenOrSymbol.length === 42) {
    return { address: tokenOrSymbol as `0x${string}`, decimals: 18, symbol: "UNKNOWN" };
  }

  throw new Error(`Unknown token: ${tokenOrSymbol}`);
}

function getRouterAddress(router?: string): `0x${string}` {
  if (router?.startsWith("0x")) return router as `0x${string}`;
  return DEX_ROUTERS[router ?? "default"];
}

export async function getSwapQuote(
  params: SwapParams,
  chainId: SupportedChainId = 167000
): Promise<SwapQuote> {
  const client = createPublicClient({
    chain: getChain(chainId),
    transport: http(),
  });

  const fromResolved = resolveTokenAddress(params.fromToken, chainId);
  const toResolved = resolveTokenAddress(params.toToken, chainId);
  const slippageBps = params.slippageBps ?? 50;
  const routerAddress = getRouterAddress(params.router);

  const amountIn = parseUnits(params.amount, fromResolved.decimals);
  const path = [fromResolved.address, toResolved.address];

  try {
    const amounts = await client.readContract({
      address: routerAddress,
      abi: ROUTER_ABI,
      functionName: "getAmountsOut",
      args: [amountIn, path],
    });

    const estimatedOut = amounts[amounts.length - 1];
    const minOut = estimatedOut - (estimatedOut * BigInt(slippageBps)) / 10000n;

    return {
      fromToken: fromResolved.symbol,
      toToken: toResolved.symbol,
      amountIn: params.amount,
      estimatedAmountOut: formatUnits(estimatedOut, toResolved.decimals),
      slippageBps,
      minimumAmountOut: formatUnits(minOut, toResolved.decimals),
      router: routerAddress,
    };
  } catch {
    throw new Error(
      `Failed to get swap quote. The router at ${routerAddress} may not support this pair or may not be deployed.`
    );
  }
}

export async function executeSwap(
  wallet: SessionWallet,
  params: SwapParams
): Promise<SwapResult> {
  const chainId = wallet.chainId;
  const fromResolved = resolveTokenAddress(params.fromToken, chainId);
  const toResolved = resolveTokenAddress(params.toToken, chainId);
  const routerAddress = getRouterAddress(params.router);
  const slippageBps = params.slippageBps ?? 50;
  const amountIn = parseUnits(params.amount, fromResolved.decimals);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes

  const path = [fromResolved.address, toResolved.address];

  const isFromETH = params.fromToken.toUpperCase() === "ETH";
  const isToETH = params.toToken.toUpperCase() === "ETH";

  let data: `0x${string}`;
  let value = 0n;

  if (isFromETH) {
    data = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: "swapExactETHForTokens",
      args: [0n, path, wallet.address, deadline],
    });
    value = amountIn;
  } else if (isToETH) {
    data = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: "swapExactTokensForETH",
      args: [amountIn, 0n, path, wallet.address, deadline],
    });
  } else {
    data = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: "swapExactTokensForTokens",
      args: [amountIn, 0n, path, wallet.address, deadline],
    });
  }

  const result = await wallet.sendTransaction({
    to: routerAddress,
    value,
    data,
  });

  return {
    hash: result.hash as Hash,
    explorerUrl: result.explorerUrl,
    fromToken: fromResolved.symbol,
    toToken: toResolved.symbol,
    amountIn: params.amount,
  };
}
