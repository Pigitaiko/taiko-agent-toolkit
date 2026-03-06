#!/usr/bin/env node

import { Command } from "commander";
import { TaikoAgentKit } from "./index.js";
import { SessionWallet } from "./wallet/index.js";
import { getAllBalances } from "./tokens/index.js";
import { getChainInfo, getBlockNumber, getGasPrice } from "./rpc/index.js";
import { isValidAddress } from "./utils/index.js";
import type { SupportedChainId } from "./config/chains.js";

const program = new Command();

program
  .name("taiko-agent")
  .description("Onchain toolkit for AI agents on the Taiko network")
  .version("0.1.0");

// --- Wallet commands ---
const walletCmd = program.command("wallet").description("Manage session wallets");

walletCmd
  .command("create")
  .description("Create a new session wallet")
  .option("-l, --limit <eth>", "Spending limit in ETH", "0.1")
  .option("-t, --ttl <seconds>", "Time-to-live in seconds", "3600")
  .option("-c, --chain <id>", "Chain ID (167000=mainnet, 167013=hoodi)", "167000")
  .option("-p, --password <pwd>", "Encryption password (auto-generated if omitted)")
  .action((opts) => {
    const wallet = SessionWallet.create(
      {
        spendingLimitEth: opts.limit,
        ttlSeconds: parseInt(opts.ttl),
        chainId: parseInt(opts.chain) as SupportedChainId,
      },
      opts.password
    );
    console.log(`Session wallet created!`);
    console.log(`  Address: ${wallet.address}`);
    console.log(`  Chain: ${wallet.chainId}`);
    console.log(`  Spending limit: ${opts.limit} ETH`);
    console.log(`  TTL: ${opts.ttl}s`);
    if (!opts.password) {
      console.log(`\n  NOTE: Auto-generated password. Use --password to set your own.`);
    }
  });

walletCmd
  .command("list")
  .description("List all session wallets")
  .action(() => {
    const wallets = SessionWallet.list();
    if (wallets.length === 0) {
      console.log("No session wallets found.");
      return;
    }
    console.log(`Found ${wallets.length} wallet(s):\n`);
    for (const w of wallets) {
      const expired = Date.now() - w.createdAt > w.ttlSeconds * 1000;
      console.log(`  ${w.address}`);
      console.log(`    Chain: ${w.chainId} | Limit: ${w.spendingLimitEth} ETH | Spent: ${w.spentEth} ETH | ${expired ? "EXPIRED" : "Active"}`);
    }
  });

walletCmd
  .command("info <address>")
  .description("Get wallet info")
  .option("-p, --password <pwd>", "Wallet password", "")
  .action(async (address, opts) => {
    try {
      const wallet = SessionWallet.load(address as `0x${string}`, opts.password);
      const info = wallet.getInfo();
      const balance = await wallet.getBalance();
      console.log(`Wallet: ${info.address}`);
      console.log(`  Chain: ${info.chainId}`);
      console.log(`  Balance: ${balance} ETH`);
      console.log(`  Spending limit: ${info.spendingLimitEth} ETH`);
      console.log(`  Spent: ${info.spentEth} ETH`);
      console.log(`  Remaining: ${info.remainingLimitEth} ETH`);
      console.log(`  TTL remaining: ${Math.round(info.remainingTtlSeconds)}s`);
      console.log(`  Status: ${info.isExpired ? "EXPIRED" : "Active"}`);
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
    }
  });

// --- Token commands ---
const tokenCmd = program.command("tokens").description("Token operations");

tokenCmd
  .command("balances <address>")
  .description("Get all token balances for an address")
  .option("-c, --chain <id>", "Chain ID", "167000")
  .action(async (address, opts) => {
    if (!isValidAddress(address)) {
      console.error("Invalid address");
      return;
    }
    const balances = await getAllBalances(
      address as `0x${string}`,
      parseInt(opts.chain) as SupportedChainId
    );
    console.log(`Balances for ${address}:\n`);
    for (const b of balances) {
      console.log(`  ${b.symbol}: ${b.balance}`);
    }
  });

tokenCmd
  .command("send")
  .description("Send tokens")
  .requiredOption("-w, --wallet <address>", "Wallet address")
  .requiredOption("-p, --password <pwd>", "Wallet password")
  .requiredOption("--to <address>", "Recipient address")
  .requiredOption("-a, --amount <amount>", "Amount to send")
  .option("-t, --token <symbol>", "Token symbol (default: ETH)", "ETH")
  .action(async (opts) => {
    try {
      const wallet = SessionWallet.load(opts.wallet as `0x${string}`, opts.password);
      const { transfer } = await import("./tokens/index.js");
      const result = await transfer(wallet, {
        to: opts.to as `0x${string}`,
        amount: opts.amount,
        token: opts.token,
      });
      console.log(`Transfer successful!`);
      console.log(`  Hash: ${result.hash}`);
      console.log(`  Explorer: ${result.explorerUrl}`);
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
    }
  });

// --- Chain commands ---
const chainCmd = program.command("chain").description("Chain information");

chainCmd
  .command("info")
  .description("Get chain info")
  .option("-c, --chain <id>", "Chain ID", "167000")
  .action(async (opts) => {
    const info = await getChainInfo(parseInt(opts.chain) as SupportedChainId);
    console.log(`Chain: ${info.name}`);
    console.log(`  Chain ID: ${info.chainId}`);
    console.log(`  Block: ${info.blockNumber}`);
    console.log(`  Gas price: ${info.gasPrice}`);
    console.log(`  Latest block: ${info.latestBlockTimestamp}`);
    console.log(`  RPC: ${info.rpcUrl}`);
    console.log(`  Explorer: ${info.explorerUrl}`);
  });

chainCmd
  .command("block")
  .description("Get latest block number")
  .option("-c, --chain <id>", "Chain ID", "167000")
  .action(async (opts) => {
    const block = await getBlockNumber(parseInt(opts.chain) as SupportedChainId);
    console.log(`Latest block: ${block}`);
  });

chainCmd
  .command("gas")
  .description("Get current gas price")
  .option("-c, --chain <id>", "Chain ID", "167000")
  .action(async (opts) => {
    const gas = await getGasPrice(parseInt(opts.chain) as SupportedChainId);
    console.log(`Gas price: ${gas} gwei`);
  });

// --- Swap commands ---
const swapCmd = program.command("swap").description("TaikoSwap DEX operations");

swapCmd
  .command("quote")
  .description("Get a swap quote from TaikoSwap")
  .requiredOption("-f, --from <token>", "From token (symbol or address)")
  .requiredOption("-t, --to <token>", "To token (symbol or address)")
  .requiredOption("-a, --amount <amount>", "Amount of from-token")
  .option("-s, --slippage <bps>", "Slippage in basis points", "50")
  .option("-c, --chain <id>", "Chain ID", "167000")
  .action(async (opts) => {
    try {
      const { getSwapQuote } = await import("./swap/index.js");
      const quote = await getSwapQuote(
        {
          fromToken: opts.from,
          toToken: opts.to,
          amount: opts.amount,
          slippageBps: parseInt(opts.slippage),
        },
        parseInt(opts.chain) as SupportedChainId
      );
      console.log(`Swap Quote (TaikoSwap):\n`);
      console.log(`  ${quote.amountIn} ${quote.fromToken} -> ~${quote.estimatedAmountOut} ${quote.toToken}`);
      console.log(`  Minimum out: ${quote.minimumAmountOut} ${quote.toToken}`);
      console.log(`  Slippage: ${quote.slippageBps / 100}%`);
      console.log(`  Router: ${quote.router}`);
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
    }
  });

swapCmd
  .command("execute")
  .description("Execute a swap on TaikoSwap")
  .requiredOption("-w, --wallet <address>", "Wallet address")
  .requiredOption("-p, --password <pwd>", "Wallet password")
  .requiredOption("-f, --from <token>", "From token (symbol or address)")
  .requiredOption("-t, --to <token>", "To token (symbol or address)")
  .requiredOption("-a, --amount <amount>", "Amount of from-token")
  .option("-s, --slippage <bps>", "Slippage in basis points", "50")
  .action(async (opts) => {
    try {
      const wallet = SessionWallet.load(opts.wallet as `0x${string}`, opts.password);
      const { executeSwap } = await import("./swap/index.js");
      const result = await executeSwap(wallet, {
        fromToken: opts.from,
        toToken: opts.to,
        amount: opts.amount,
        slippageBps: parseInt(opts.slippage),
      });
      console.log(`Swap executed!`);
      console.log(`  ${result.amountIn} ${result.fromToken} -> ${result.toToken}`);
      console.log(`  Hash: ${result.hash}`);
      console.log(`  Explorer: ${result.explorerUrl}`);
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
    }
  });

// --- Quick start ---
program
  .command("init")
  .description("Initialize a new agent with wallet and identity")
  .option("-n, --name <name>", "Agent name", "my-taiko-agent")
  .option("-c, --chain <id>", "Chain ID", "167000")
  .action(async (opts) => {
    console.log(`\nInitializing Taiko Agent: ${opts.name}\n`);

    const kit = TaikoAgentKit.create({
      chainId: parseInt(opts.chain) as SupportedChainId,
      walletConfig: { spendingLimitEth: "0.1", ttlSeconds: 3600 },
    });

    console.log(`  Wallet created: ${kit.getAddress()}`);
    console.log(`  Chain: ${opts.chain}`);
    console.log(`\nNext steps:`);
    console.log(`  1. Fund your wallet: send ETH to ${kit.getAddress()}`);
    console.log(`  2. Check balance: taiko-agent tokens balances ${kit.getAddress()}`);
    console.log(`  3. Use the SDK in your agent code:\n`);
    console.log(`     import { TaikoAgentKit } from "@taiko/agent-toolkit";`);
    console.log(`     const kit = TaikoAgentKit.create();`);
    console.log(`     const balance = await kit.getBalance();`);
    console.log(`     await kit.transfer({ to: "0x...", amount: "0.01" });`);
  });

program.parse();
