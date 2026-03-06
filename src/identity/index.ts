import {
  createPublicClient,
  http,
  encodeFunctionData,
  type Hash,
} from "viem";
import { SessionWallet } from "../wallet/session-wallet.js";
import { getChain, type SupportedChainId } from "../config/chains.js";

// Agent Identity Registry ABI — inspired by ERC-8004 for onchain agent identity
const AGENT_REGISTRY_ABI = [
  {
    name: "registerAgent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "bytes32" },
      { name: "metadata", type: "string" },
      { name: "owner", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "updateMetadata",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "bytes32" },
      { name: "metadata", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "getAgent",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "metadata", type: "string" },
      { name: "reputation", type: "uint256" },
      { name: "registeredAt", type: "uint256" },
    ],
  },
  {
    name: "reportSuccess",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "reportFailure",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [],
  },
] as const;

// Placeholder — deploy on Taiko and update
const AGENT_REGISTRY_ADDRESS: `0x${string}` = "0x0000000000000000000000000000000000000000";

export interface AgentMetadata {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  framework?: string;
  contactUri?: string;
}

export interface AgentInfo {
  agentId: string;
  owner: `0x${string}`;
  metadata: AgentMetadata;
  reputation: bigint;
  registeredAt: number;
}

export function createAgentId(name: string, owner: `0x${string}`): `0x${string}` {
  // Create a deterministic agent ID from name + owner
  const encoder = new TextEncoder();
  const data = encoder.encode(`${name.toLowerCase()}:${owner.toLowerCase()}`);
  // Simple hash using Web Crypto-compatible approach
  let hash = 0n;
  for (const byte of data) {
    hash = ((hash << 8n) | BigInt(byte)) & ((1n << 256n) - 1n);
  }
  return `0x${hash.toString(16).padStart(64, "0")}` as `0x${string}`;
}

export async function registerAgent(
  wallet: SessionWallet,
  metadata: AgentMetadata,
  registryAddress?: `0x${string}`
): Promise<{ hash: Hash; agentId: `0x${string}` }> {
  const registry = registryAddress ?? AGENT_REGISTRY_ADDRESS;
  const agentId = createAgentId(metadata.name, wallet.address);

  const data = encodeFunctionData({
    abi: AGENT_REGISTRY_ABI,
    functionName: "registerAgent",
    args: [agentId, JSON.stringify(metadata), wallet.address],
  });

  const result = await wallet.sendTransaction({
    to: registry,
    data,
  });

  return { hash: result.hash as Hash, agentId };
}

export async function getAgentInfo(
  agentId: `0x${string}`,
  chainId: SupportedChainId = 167000,
  registryAddress?: `0x${string}`
): Promise<AgentInfo | null> {
  const registry = registryAddress ?? AGENT_REGISTRY_ADDRESS;
  const client = createPublicClient({
    chain: getChain(chainId),
    transport: http(),
  });

  try {
    const [owner, metadataStr, reputation, registeredAt] = await client.readContract({
      address: registry,
      abi: AGENT_REGISTRY_ABI,
      functionName: "getAgent",
      args: [agentId],
    });

    if (owner === "0x0000000000000000000000000000000000000000") {
      return null;
    }

    return {
      agentId: agentId,
      owner: owner as `0x${string}`,
      metadata: JSON.parse(metadataStr as string),
      reputation: reputation as bigint,
      registeredAt: Number(registeredAt),
    };
  } catch {
    return null;
  }
}

export async function updateAgentMetadata(
  wallet: SessionWallet,
  agentId: `0x${string}`,
  metadata: AgentMetadata,
  registryAddress?: `0x${string}`
): Promise<Hash> {
  const registry = registryAddress ?? AGENT_REGISTRY_ADDRESS;

  const data = encodeFunctionData({
    abi: AGENT_REGISTRY_ABI,
    functionName: "updateMetadata",
    args: [agentId, JSON.stringify(metadata)],
  });

  const result = await wallet.sendTransaction({
    to: registry,
    data,
  });

  return result.hash as Hash;
}

export async function reportAgentOutcome(
  wallet: SessionWallet,
  agentId: `0x${string}`,
  success: boolean,
  registryAddress?: `0x${string}`
): Promise<Hash> {
  const registry = registryAddress ?? AGENT_REGISTRY_ADDRESS;
  const fnName = success ? "reportSuccess" : "reportFailure";

  const data = encodeFunctionData({
    abi: AGENT_REGISTRY_ABI,
    functionName: fnName,
    args: [agentId],
  });

  const result = await wallet.sendTransaction({
    to: registry,
    data,
  });

  return result.hash as Hash;
}
