import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  parseEther,
  formatEther,
  type Hash,
} from "viem";
import { SessionWallet } from "../wallet/session-wallet.js";
import { taikoMainnet, ethereum, getChain, type SupportedChainId } from "../config/chains.js";

// Simplified Taiko Bridge ABI (core functions)
const BRIDGE_ABI = [
  {
    name: "sendMessage",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "_message",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "from", type: "address" },
          { name: "srcChainId", type: "uint64" },
          { name: "destChainId", type: "uint64" },
          { name: "srcOwner", type: "address" },
          { name: "destOwner", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "fee", type: "uint256" },
          { name: "gasLimit", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "msgHash_", type: "bytes32" },
      {
        name: "message_",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "from", type: "address" },
          { name: "srcChainId", type: "uint64" },
          { name: "destChainId", type: "uint64" },
          { name: "srcOwner", type: "address" },
          { name: "destOwner", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "fee", type: "uint256" },
          { name: "gasLimit", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
  },
] as const;

export interface BridgeParams {
  amount: string; // ETH amount
  to?: `0x${string}`; // Destination address (defaults to sender)
  from: SupportedChainId;
  toChain: SupportedChainId;
  processingFeeEth?: string;
}

export interface BridgeResult {
  hash: Hash;
  explorerUrl: string;
  fromChain: string;
  toChain: string;
  amount: string;
  status: "pending";
}

export async function estimateBridgeFee(
  from: SupportedChainId,
  _to: SupportedChainId
): Promise<string> {
  const client = createPublicClient({
    chain: getChain(from),
    transport: http(),
  });

  const gasPrice = await client.getGasPrice();
  // Rough estimation: bridge tx ~200k gas + processing fee
  const estimatedGas = 200000n;
  const fee = gasPrice * estimatedGas;
  return formatEther(fee);
}

export async function bridgeETH(
  wallet: SessionWallet,
  params: BridgeParams
): Promise<BridgeResult> {
  const { amount, from, toChain, processingFeeEth } = params;
  const to = params.to ?? wallet.address;
  const value = parseEther(amount);
  const fee = parseEther(processingFeeEth ?? "0.001");

  const fromChain = getChain(from);
  const destChain = getChain(toChain);
  const bridgeAddress = taikoMainnet.contracts?.bridge?.address;

  if (!bridgeAddress) {
    throw new Error("Bridge contract address not configured");
  }

  const message = {
    id: 0n,
    from: wallet.address,
    srcChainId: BigInt(from),
    destChainId: BigInt(toChain),
    srcOwner: wallet.address,
    destOwner: to,
    to,
    value,
    fee,
    gasLimit: 140000n,
    data: "0x" as `0x${string}`,
  };

  const data = encodeFunctionData({
    abi: BRIDGE_ABI,
    functionName: "sendMessage",
    args: [message],
  });

  const totalValue = value + fee;

  const result = await wallet.sendTransaction({
    to: bridgeAddress,
    value: totalValue,
    data,
  });

  return {
    hash: result.hash as Hash,
    explorerUrl: result.explorerUrl,
    fromChain: fromChain.name,
    toChain: destChain.name,
    amount,
    status: "pending",
  };
}

export async function getBridgeStatus(
  txHash: Hash,
  chainId: SupportedChainId
): Promise<{ confirmed: boolean; blockNumber: bigint | null }> {
  const client = createPublicClient({
    chain: getChain(chainId),
    transport: http(),
  });

  try {
    const receipt = await client.getTransactionReceipt({ hash: txHash });
    return {
      confirmed: receipt.status === "success",
      blockNumber: receipt.blockNumber,
    };
  } catch {
    return { confirmed: false, blockNumber: null };
  }
}
