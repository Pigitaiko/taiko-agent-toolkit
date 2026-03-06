import {
  createWalletClient,
  createPublicClient,
  http,
  formatEther,
  parseEther,
  type WalletClient,
  type PublicClient,
  type Account,
  type Chain,
  type Transport,
  type Hash,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { taikoMainnet, type SupportedChainId, getChain } from "../config/chains.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

export interface SessionWalletConfig {
  spendingLimitEth?: string;
  allowedContracts?: `0x${string}`[];
  ttlSeconds?: number;
  chainId?: SupportedChainId;
}

export interface SessionWalletState {
  address: `0x${string}`;
  encryptedKey: string;
  iv: string;
  salt: string;
  spentEth: string;
  spendingLimitEth: string;
  allowedContracts: `0x${string}`[];
  createdAt: number;
  ttlSeconds: number;
  chainId: SupportedChainId;
}

const WALLET_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || ".",
  ".taiko-agent",
  "wallets"
);

function ensureWalletDir() {
  fs.mkdirSync(WALLET_DIR, { recursive: true });
}

function deriveEncryptionKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
}

function encryptPrivateKey(privateKey: string, password: string): { encrypted: string; iv: string; salt: string } {
  const salt = crypto.randomBytes(16);
  const key = deriveEncryptionKey(password, salt);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(privateKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  return { encrypted, iv: iv.toString("hex"), salt: salt.toString("hex") };
}

function decryptPrivateKey(encrypted: string, iv: string, salt: string, password: string): string {
  const key = deriveEncryptionKey(password, Buffer.from(salt, "hex"));
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, Buffer.from(iv, "hex"));
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export class SessionWallet {
  private walletClient: WalletClient<Transport, Chain, Account>;
  private publicClient: PublicClient<Transport, Chain>;
  private state: SessionWalletState;
  private account: Account;

  private constructor(
    account: Account,
    state: SessionWalletState,
    chain: Chain
  ) {
    this.account = account;
    this.state = state;

    this.publicClient = createPublicClient({
      chain,
      transport: http(),
    });

    this.walletClient = createWalletClient({
      account,
      chain,
      transport: http(),
    });
  }

  static create(config: SessionWalletConfig = {}, password?: string): SessionWallet {
    const chainId = config.chainId ?? 167000;
    const chain = getChain(chainId);
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const pwd = password ?? crypto.randomBytes(32).toString("hex");

    const { encrypted, iv, salt } = encryptPrivateKey(privateKey, pwd);

    const state: SessionWalletState = {
      address: account.address,
      encryptedKey: encrypted,
      iv,
      salt,
      spentEth: "0",
      spendingLimitEth: config.spendingLimitEth ?? "0.1",
      allowedContracts: config.allowedContracts ?? [],
      createdAt: Date.now(),
      ttlSeconds: config.ttlSeconds ?? 3600,
      chainId,
    };

    const wallet = new SessionWallet(account, state, chain);
    wallet.save();
    return wallet;
  }

  static load(address: `0x${string}`, password: string): SessionWallet {
    ensureWalletDir();
    const filePath = path.join(WALLET_DIR, `${address.toLowerCase()}.json`);
    const raw = fs.readFileSync(filePath, "utf8");
    const state: SessionWalletState = JSON.parse(raw);

    if (Date.now() - state.createdAt > state.ttlSeconds * 1000) {
      fs.unlinkSync(filePath);
      throw new Error(`Session wallet ${address} has expired`);
    }

    const privateKey = decryptPrivateKey(state.encryptedKey, state.iv, state.salt, password);
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const chain = getChain(state.chainId);

    return new SessionWallet(account, state, chain);
  }

  static list(): SessionWalletState[] {
    ensureWalletDir();
    const files = fs.readdirSync(WALLET_DIR).filter((f) => f.endsWith(".json"));
    return files.map((f) => JSON.parse(fs.readFileSync(path.join(WALLET_DIR, f), "utf8")));
  }

  private save() {
    ensureWalletDir();
    const filePath = path.join(WALLET_DIR, `${this.state.address.toLowerCase()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(this.state, null, 2));
  }

  get address(): `0x${string}` {
    return this.state.address;
  }

  get chainId(): SupportedChainId {
    return this.state.chainId;
  }

  isExpired(): boolean {
    return Date.now() - this.state.createdAt > this.state.ttlSeconds * 1000;
  }

  remainingTtlSeconds(): number {
    const elapsed = (Date.now() - this.state.createdAt) / 1000;
    return Math.max(0, this.state.ttlSeconds - elapsed);
  }

  remainingSpendingLimit(): string {
    const limit = parseEther(this.state.spendingLimitEth);
    const spent = parseEther(this.state.spentEth);
    const remaining = limit - spent;
    return formatEther(remaining > 0n ? remaining : 0n);
  }

  async getBalance(): Promise<string> {
    const balance = await this.publicClient.getBalance({ address: this.account.address });
    return formatEther(balance);
  }

  async sendTransaction(params: {
    to: `0x${string}`;
    value?: bigint;
    data?: `0x${string}`;
  }): Promise<{ hash: Hash; explorerUrl: string }> {
    if (this.isExpired()) {
      throw new Error("Session wallet has expired");
    }

    const value = params.value ?? 0n;

    // Enforce spending limit
    const newSpent = parseEther(this.state.spentEth) + value;
    if (newSpent > parseEther(this.state.spendingLimitEth)) {
      throw new Error(
        `Transaction would exceed spending limit. ` +
        `Limit: ${this.state.spendingLimitEth} ETH, ` +
        `Already spent: ${this.state.spentEth} ETH, ` +
        `This tx: ${formatEther(value)} ETH`
      );
    }

    // Enforce contract allowlist (if set)
    if (this.state.allowedContracts.length > 0 && params.data) {
      const isAllowed = this.state.allowedContracts.some(
        (c) => c.toLowerCase() === params.to.toLowerCase()
      );
      if (!isAllowed) {
        throw new Error(`Contract ${params.to} is not in the allowed contracts list`);
      }
    }

    const hash = await this.walletClient.sendTransaction({
      to: params.to,
      value,
      data: params.data,
      chain: getChain(this.state.chainId),
    });

    // Update spent amount
    this.state.spentEth = formatEther(newSpent);
    this.save();

    const chain = getChain(this.state.chainId);
    const explorerUrl = `${chain.blockExplorers?.default.url}/tx/${hash}`;

    return { hash, explorerUrl };
  }

  async waitForTransaction(hash: Hash) {
    return this.publicClient.waitForTransactionReceipt({ hash });
  }

  getInfo() {
    return {
      address: this.state.address,
      chainId: this.state.chainId,
      spendingLimitEth: this.state.spendingLimitEth,
      spentEth: this.state.spentEth,
      remainingLimitEth: this.remainingSpendingLimit(),
      isExpired: this.isExpired(),
      remainingTtlSeconds: this.remainingTtlSeconds(),
      allowedContracts: this.state.allowedContracts,
    };
  }

  destroy() {
    const filePath = path.join(WALLET_DIR, `${this.state.address.toLowerCase()}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
