import {
  encodeFunctionData,
  parseUnits,
  erc20Abi,
} from "viem";
import { SessionWallet } from "../wallet/session-wallet.js";
import { KNOWN_TOKENS, type SupportedChainId } from "../config/chains.js";

export interface TransferParams {
  to: `0x${string}`;
  amount: string;
  token?: string; // symbol or address, defaults to native ETH
}

export interface TransferResult {
  hash: string;
  explorerUrl: string;
  from: `0x${string}`;
  to: `0x${string}`;
  amount: string;
  token: string;
}

function resolveToken(
  tokenOrSymbol: string,
  chainId: SupportedChainId
): { address: `0x${string}`; decimals: number; symbol: string } | null {
  // Check if it's a known symbol
  const upper = tokenOrSymbol.toUpperCase();
  const known = KNOWN_TOKENS[upper]?.find((t) => t.chainId === chainId);
  if (known) return known;

  // Check if it looks like an address
  if (tokenOrSymbol.startsWith("0x") && tokenOrSymbol.length === 42) {
    return { address: tokenOrSymbol as `0x${string}`, decimals: 18, symbol: "UNKNOWN" };
  }

  return null;
}

export async function transfer(
  wallet: SessionWallet,
  params: TransferParams
): Promise<TransferResult> {
  const { to, amount, token } = params;

  // Native ETH transfer
  if (!token || token.toUpperCase() === "ETH") {
    const value = parseUnits(amount, 18);
    const { hash, explorerUrl } = await wallet.sendTransaction({ to, value });
    return { hash, explorerUrl, from: wallet.address, to, amount, token: "ETH" };
  }

  // ERC20 transfer
  const resolved = resolveToken(token, wallet.chainId);
  if (!resolved) {
    throw new Error(`Unknown token: ${token}. Provide a known symbol or contract address.`);
  }

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, parseUnits(amount, resolved.decimals)],
  });

  const { hash, explorerUrl } = await wallet.sendTransaction({
    to: resolved.address,
    data,
  });

  return { hash, explorerUrl, from: wallet.address, to, amount, token: resolved.symbol };
}
