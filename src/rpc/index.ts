import {
  createPublicClient,
  http,
  formatEther,
  formatGwei,
  type Hash,
  type TransactionReceipt,
  type Block,
  type PublicClient,
  type Chain,
  type Transport,
} from "viem";
import { getChain, type SupportedChainId } from "../config/chains.js";

const clients = new Map<SupportedChainId, PublicClient<Transport, Chain>>();

export function getPublicClient(chainId: SupportedChainId = 167000): PublicClient<Transport, Chain> {
  if (!clients.has(chainId)) {
    clients.set(
      chainId,
      createPublicClient({
        chain: getChain(chainId),
        transport: http(),
      })
    );
  }
  return clients.get(chainId)!;
}

export async function getBlockNumber(chainId: SupportedChainId = 167000): Promise<bigint> {
  return getPublicClient(chainId).getBlockNumber();
}

export async function getBlock(
  blockNumber?: bigint,
  chainId: SupportedChainId = 167000
): Promise<Block> {
  const client = getPublicClient(chainId);
  if (blockNumber !== undefined) {
    return client.getBlock({ blockNumber });
  }
  return client.getBlock();
}

export async function getGasPrice(chainId: SupportedChainId = 167000): Promise<string> {
  const price = await getPublicClient(chainId).getGasPrice();
  return formatGwei(price);
}

export async function getTransactionReceipt(
  hash: Hash,
  chainId: SupportedChainId = 167000
): Promise<TransactionReceipt> {
  return getPublicClient(chainId).getTransactionReceipt({ hash });
}

export async function getTransaction(hash: Hash, chainId: SupportedChainId = 167000) {
  return getPublicClient(chainId).getTransaction({ hash });
}

export async function estimateGas(
  params: { to: `0x${string}`; value?: bigint; data?: `0x${string}` },
  chainId: SupportedChainId = 167000
): Promise<string> {
  const gas = await getPublicClient(chainId).estimateGas({
    to: params.to,
    value: params.value,
    data: params.data,
  });
  return gas.toString();
}

export async function getChainInfo(chainId: SupportedChainId = 167000) {
  const client = getPublicClient(chainId);
  const [blockNumber, gasPrice, block] = await Promise.all([
    client.getBlockNumber(),
    client.getGasPrice(),
    client.getBlock(),
  ]);

  const chain = getChain(chainId);

  return {
    name: chain.name,
    chainId,
    blockNumber: blockNumber.toString(),
    gasPrice: formatGwei(gasPrice) + " gwei",
    latestBlockTimestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
    rpcUrl: chain.rpcUrls.default.http[0],
    explorerUrl: chain.blockExplorers?.default.url ?? "N/A",
  };
}

export async function readContract(params: {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  chainId?: SupportedChainId;
}) {
  const client = getPublicClient(params.chainId ?? 167000);
  return client.readContract({
    address: params.address,
    abi: params.abi as any,
    functionName: params.functionName,
    args: params.args as any,
  });
}
