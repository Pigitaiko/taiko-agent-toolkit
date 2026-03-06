import {
  createPublicClient,
  http,
  formatUnits,
  formatEther,
  type PublicClient,
  type Chain,
  type Transport,
  erc20Abi,
} from "viem";
import { getChain, KNOWN_TOKENS, type SupportedChainId } from "../config/chains.js";

export interface TokenBalance {
  symbol: string;
  address: `0x${string}` | "native";
  balance: string;
  decimals: number;
}

function getClient(chainId: SupportedChainId): PublicClient<Transport, Chain> {
  return createPublicClient({
    chain: getChain(chainId),
    transport: http(),
  });
}

export async function getNativeBalance(
  address: `0x${string}`,
  chainId: SupportedChainId = 167000
): Promise<TokenBalance> {
  const client = getClient(chainId);
  const balance = await client.getBalance({ address });
  return {
    symbol: "ETH",
    address: "native",
    balance: formatEther(balance),
    decimals: 18,
  };
}

export async function getERC20Balance(
  walletAddress: `0x${string}`,
  tokenAddress: `0x${string}`,
  chainId: SupportedChainId = 167000
): Promise<TokenBalance> {
  const client = getClient(chainId);

  const [balance, decimals, symbol] = await Promise.all([
    client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [walletAddress],
    }),
    client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "decimals",
    }),
    client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "symbol",
    }),
  ]);

  return {
    symbol,
    address: tokenAddress,
    balance: formatUnits(balance, decimals),
    decimals,
  };
}

export async function getAllBalances(
  walletAddress: `0x${string}`,
  chainId: SupportedChainId = 167000
): Promise<TokenBalance[]> {
  const tokensOnChain = Object.values(KNOWN_TOKENS)
    .flat()
    .filter((t) => t.chainId === chainId);

  const results = await Promise.allSettled([
    getNativeBalance(walletAddress, chainId),
    ...tokensOnChain.map((t) => getERC20Balance(walletAddress, t.address, chainId)),
  ]);

  return results
    .filter((r): r is PromiseFulfilledResult<TokenBalance> => r.status === "fulfilled")
    .map((r) => r.value);
}

export async function getTokenPrice(_symbol: string): Promise<number | null> {
  // Placeholder for price feed integration (Chainlink, CoinGecko, etc.)
  // In production, integrate with a price oracle on Taiko or an external API
  return null;
}
