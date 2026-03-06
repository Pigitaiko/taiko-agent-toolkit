// Taiko Agent Toolkit — Onchain toolkit for AI agents on Taiko
// Framework-agnostic TypeScript SDK

// Chain configuration
export {
  taikoMainnet,
  taikoHoodi,
  ethereum,
  getChain,
  CHAIN_MAP,
  KNOWN_TOKENS,
  TAIKO_L1_CONTRACTS,
  TAIKOSWAP_CONTRACTS,
  type SupportedChainId,
} from "./config/chains.js";

// Wallet management
export {
  SessionWallet,
  type SessionWalletConfig,
  type SessionWalletState,
} from "./wallet/index.js";

// Token operations
export {
  getNativeBalance,
  getERC20Balance,
  getAllBalances,
  getTokenPrice,
  transfer,
  type TokenBalance,
  type TransferParams,
  type TransferResult,
} from "./tokens/index.js";

// Bridge
export {
  bridgeETH,
  estimateBridgeFee,
  getBridgeStatus,
  type BridgeParams,
  type BridgeResult,
} from "./bridge/index.js";

// Swap
export {
  getSwapQuote,
  executeSwap,
  type SwapParams,
  type SwapQuote,
  type SwapResult,
} from "./swap/index.js";

// Agent identity & reputation
export {
  registerAgent,
  getAgentInfo,
  updateAgentMetadata,
  reportAgentOutcome,
  createAgentId,
  type AgentMetadata,
  type AgentInfo,
} from "./identity/index.js";

// RPC & chain queries
export {
  getPublicClient,
  getBlockNumber,
  getBlock,
  getGasPrice,
  getTransactionReceipt,
  getTransaction,
  estimateGas,
  getChainInfo,
  readContract,
} from "./rpc/index.js";

// Utilities
export {
  shortenAddress,
  shortenHash,
  isValidAddress,
  isValidTxHash,
  explorerTxUrl,
  explorerAddressUrl,
} from "./utils/index.js";

// --- TaikoAgentKit: High-level unified interface ---

import { SessionWallet, type SessionWalletConfig } from "./wallet/index.js";
import { getAllBalances, transfer, type TransferParams } from "./tokens/index.js";
import { bridgeETH, type BridgeParams } from "./bridge/index.js";
import { executeSwap, getSwapQuote, type SwapParams } from "./swap/index.js";
import {
  registerAgent,
  getAgentInfo,
  createAgentId,
  type AgentMetadata,
} from "./identity/index.js";
import { getChainInfo, getBlockNumber as rpcGetBlockNumber } from "./rpc/index.js";
import type { SupportedChainId } from "./config/chains.js";

export interface TaikoAgentKitConfig {
  chainId?: SupportedChainId;
  walletConfig?: SessionWalletConfig;
  walletPassword?: string;
  registryAddress?: `0x${string}`;
}

export class TaikoAgentKit {
  public wallet: SessionWallet;
  private chainId: SupportedChainId;
  private registryAddress?: `0x${string}`;

  private constructor(wallet: SessionWallet, chainId: SupportedChainId, registryAddress?: `0x${string}`) {
    this.wallet = wallet;
    this.chainId = chainId;
    this.registryAddress = registryAddress;
  }

  static create(config: TaikoAgentKitConfig = {}): TaikoAgentKit {
    const chainId = config.chainId ?? 167000;
    const walletConfig = { ...config.walletConfig, chainId };
    const wallet = SessionWallet.create(walletConfig, config.walletPassword);
    return new TaikoAgentKit(wallet, chainId, config.registryAddress);
  }

  static fromExistingWallet(
    address: `0x${string}`,
    password: string,
    config: Omit<TaikoAgentKitConfig, "walletConfig" | "walletPassword"> = {}
  ): TaikoAgentKit {
    const wallet = SessionWallet.load(address, password);
    return new TaikoAgentKit(wallet, config.chainId ?? wallet.chainId, config.registryAddress);
  }

  // --- Wallet ---
  getAddress(): `0x${string}` {
    return this.wallet.address;
  }

  async getBalance() {
    return this.wallet.getBalance();
  }

  getWalletInfo() {
    return this.wallet.getInfo();
  }

  // --- Tokens ---
  async getAllBalances() {
    return getAllBalances(this.wallet.address, this.chainId);
  }

  async transfer(params: TransferParams) {
    return transfer(this.wallet, params);
  }

  // --- Swap ---
  async getSwapQuote(params: SwapParams) {
    return getSwapQuote(params, this.chainId);
  }

  async swap(params: SwapParams) {
    return executeSwap(this.wallet, params);
  }

  // --- Bridge ---
  async bridge(params: Omit<BridgeParams, "from">) {
    return bridgeETH(this.wallet, { ...params, from: this.chainId });
  }

  // --- Identity ---
  async registerAgent(metadata: AgentMetadata) {
    return registerAgent(this.wallet, metadata, this.registryAddress);
  }

  async getAgentInfo(name: string) {
    const agentId = createAgentId(name, this.wallet.address);
    return getAgentInfo(agentId, this.chainId, this.registryAddress);
  }

  // --- Chain ---
  async getChainInfo() {
    return getChainInfo(this.chainId);
  }

  async getBlockNumber() {
    return rpcGetBlockNumber(this.chainId);
  }

  // --- Lifecycle ---
  destroy() {
    this.wallet.destroy();
  }
}
