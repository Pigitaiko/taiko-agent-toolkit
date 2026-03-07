/**
 * Taiko Agent Toolkit — Interactive Demo Agent
 *
 * This demo showcases a simple AI agent that can:
 * - Manage its own session wallet
 * - Check balances across tokens
 * - Get swap quotes from TaikoSwap
 * - Execute swaps, transfers, and bridges
 * - Register its onchain identity
 * - Query chain state
 *
 * Run: npx tsx examples/demo-agent.ts
 */

import * as readline from "node:readline";
import {
  TaikoAgentKit,
  getChainInfo,
  getSwapQuote,
  getAllBalances,
  getBlockNumber,
  getGasPrice,
  TAIKOSWAP_CONTRACTS,
  type SupportedChainId,
} from "../src/index.js";

// ─── Agent State ───────────────────────────────────────────────

interface AgentState {
  kit: TaikoAgentKit | null;
  chainId: SupportedChainId;
  history: string[];
}

const state: AgentState = {
  kit: null,
  chainId: 167000, // Default to mainnet
  history: [],
};

// ─── Agent Actions ─────────────────────────────────────────────

const actions: Record<string, {
  description: string;
  usage?: string;
  run: (args: string[]) => Promise<string>;
}> = {
  help: {
    description: "Show all available commands",
    async run() {
      const lines = Object.entries(actions).map(
        ([name, { description, usage }]) =>
          `  ${name.padEnd(16)} ${description}${usage ? `\n${"".padEnd(18)}Usage: ${usage}` : ""}`
      );
      return `Available commands:\n\n${lines.join("\n")}`;
    },
  },

  init: {
    description: "Create a new agent session with a wallet",
    usage: "init [mainnet|hoodi] [spendingLimit]",
    async run(args) {
      const network = args[0] ?? "mainnet";
      const limit = args[1] ?? "0.5";
      const chainId: SupportedChainId = network === "hoodi" ? 167013 : 167000;

      state.chainId = chainId;
      state.kit = TaikoAgentKit.create({
        chainId,
        walletConfig: {
          spendingLimitEth: limit,
          ttlSeconds: 7200,
        },
      });

      const info = state.kit.getWalletInfo();
      return [
        `Agent initialized on ${network === "hoodi" ? "Taiko Hoodi (testnet)" : "Taiko Mainnet"}`,
        ``,
        `  Wallet:         ${info.address}`,
        `  Spending limit: ${info.spendingLimitEth} ETH`,
        `  TTL:            ${info.remainingTtlSeconds}s`,
        `  Chain ID:       ${info.chainId}`,
        ``,
        `  >> Fund this wallet to start transacting.`,
        `  >> On Hoodi testnet, use a faucet to get test ETH.`,
      ].join("\n");
    },
  },

  status: {
    description: "Show agent wallet status and balances",
    async run() {
      if (!state.kit) return "No active session. Run: init";

      const info = state.kit.getWalletInfo();
      const balance = await state.kit.getBalance();

      return [
        `Agent Status`,
        `  Address:         ${info.address}`,
        `  Chain:           ${info.chainId}`,
        `  ETH Balance:     ${balance} ETH`,
        `  Spending limit:  ${info.spendingLimitEth} ETH`,
        `  Spent:           ${info.spentEth} ETH`,
        `  Remaining:       ${info.remainingLimitEth} ETH`,
        `  TTL remaining:   ${Math.round(info.remainingTtlSeconds)}s`,
        `  Expired:         ${info.isExpired ? "YES" : "No"}`,
      ].join("\n");
    },
  },

  balances: {
    description: "Get all token balances",
    async run() {
      if (!state.kit) return "No active session. Run: init";

      const balances = await state.kit.getAllBalances();
      if (balances.length === 0) return "No balances found.";

      const lines = balances.map(
        (b) => `  ${b.symbol.padEnd(10)} ${b.balance}`
      );
      return `Token Balances:\n\n${lines.join("\n")}`;
    },
  },

  chain: {
    description: "Show current chain info",
    async run() {
      const info = await getChainInfo(state.chainId);
      return [
        `Chain Info`,
        `  Name:          ${info.name}`,
        `  Chain ID:      ${info.chainId}`,
        `  Block:         ${info.blockNumber}`,
        `  Gas price:     ${info.gasPrice}`,
        `  Last block:    ${info.latestBlockTimestamp}`,
        `  RPC:           ${info.rpcUrl}`,
        `  Explorer:      ${info.explorerUrl}`,
      ].join("\n");
    },
  },

  quote: {
    description: "Get a swap quote from TaikoSwap",
    usage: "quote <fromToken> <toToken> <amount>",
    async run(args) {
      if (args.length < 3) return "Usage: quote <fromToken> <toToken> <amount>";

      const [fromToken, toToken, amount] = args;
      try {
        const q = await getSwapQuote(
          { fromToken, toToken, amount, slippageBps: 50 },
          state.chainId
        );
        return [
          `TaikoSwap Quote`,
          `  ${q.amountIn} ${q.fromToken} -> ~${q.estimatedAmountOut} ${q.toToken}`,
          `  Minimum out:   ${q.minimumAmountOut} ${q.toToken}`,
          `  Slippage:      ${q.slippageBps / 100}%`,
          `  Router:        ${q.router}`,
        ].join("\n");
      } catch (e: any) {
        return `Quote failed: ${e.message}`;
      }
    },
  },

  swap: {
    description: "Execute a swap on TaikoSwap",
    usage: "swap <fromToken> <toToken> <amount>",
    async run(args) {
      if (!state.kit) return "No active session. Run: init";
      if (args.length < 3) return "Usage: swap <fromToken> <toToken> <amount>";

      const [fromToken, toToken, amount] = args;

      // Preview first
      try {
        const q = await getSwapQuote(
          { fromToken, toToken, amount, slippageBps: 50 },
          state.chainId
        );
        console.log(`  Preview: ${q.amountIn} ${q.fromToken} -> ~${q.estimatedAmountOut} ${q.toToken}`);
        console.log(`  Executing...`);
      } catch {
        // Continue anyway
      }

      try {
        const result = await state.kit.swap({
          fromToken,
          toToken,
          amount,
          slippageBps: 50,
        });
        return [
          `Swap executed!`,
          `  ${result.amountIn} ${result.fromToken} -> ${result.toToken}`,
          `  Tx hash:  ${result.hash}`,
          `  Explorer: ${result.explorerUrl}`,
        ].join("\n");
      } catch (e: any) {
        return `Swap failed: ${e.message}`;
      }
    },
  },

  send: {
    description: "Send ETH or tokens to an address",
    usage: "send <to> <amount> [token]",
    async run(args) {
      if (!state.kit) return "No active session. Run: init";
      if (args.length < 2) return "Usage: send <to> <amount> [token]";

      const [to, amount, token] = args;
      try {
        const result = await state.kit.transfer({
          to: to as `0x${string}`,
          amount,
          token,
        });
        return [
          `Transfer sent!`,
          `  ${result.amount} ${result.token}: ${result.from} -> ${result.to}`,
          `  Tx hash:  ${result.hash}`,
          `  Explorer: ${result.explorerUrl}`,
        ].join("\n");
      } catch (e: any) {
        return `Transfer failed: ${e.message}`;
      }
    },
  },

  bridge: {
    description: "Bridge ETH to Ethereum L1",
    usage: "bridge <amount>",
    async run(args) {
      if (!state.kit) return "No active session. Run: init";
      if (args.length < 1) return "Usage: bridge <amount>";

      try {
        const result = await state.kit.bridge({
          amount: args[0],
          toChain: 1,
        });
        return [
          `Bridge initiated!`,
          `  ${result.amount} ETH: ${result.fromChain} -> ${result.toChain}`,
          `  Tx hash:  ${result.hash}`,
          `  Explorer: ${result.explorerUrl}`,
          `  Status:   ${result.status}`,
        ].join("\n");
      } catch (e: any) {
        return `Bridge failed: ${e.message}`;
      }
    },
  },

  register: {
    description: "Register agent identity onchain",
    usage: "register <name> <description>",
    async run(args) {
      if (!state.kit) return "No active session. Run: init";
      if (args.length < 1) return "Usage: register <name> [description]";

      const name = args[0];
      const description = args.slice(1).join(" ") || "Taiko AI Agent";

      try {
        const result = await state.kit.registerAgent({
          name,
          description,
          version: "1.0.0",
          capabilities: ["swap", "bridge", "transfer", "monitor"],
        });
        return [
          `Agent registered onchain!`,
          `  Agent ID: ${result.agentId}`,
          `  Tx hash:  ${result.hash}`,
        ].join("\n");
      } catch (e: any) {
        return `Registration failed: ${e.message}`;
      }
    },
  },

  contracts: {
    description: "Show TaikoSwap contract addresses",
    async run() {
      return [
        `TaikoSwap Contracts (verified on-chain)`,
        `  Router:       ${TAIKOSWAP_CONTRACTS.router}`,
        `  Factory:      ${TAIKOSWAP_CONTRACTS.factory}`,
        `  TKOSWAP:      ${TAIKOSWAP_CONTRACTS.tkoswapToken}`,
      ].join("\n");
    },
  },

  destroy: {
    description: "Destroy the current session wallet",
    async run() {
      if (!state.kit) return "No active session.";
      state.kit.destroy();
      state.kit = null;
      return "Session wallet destroyed.";
    },
  },

  exit: {
    description: "Exit the demo",
    async run() {
      if (state.kit) state.kit.destroy();
      console.log("\nGoodbye!\n");
      process.exit(0);
    },
  },
};

// ─── Autonomous Demo Mode ──────────────────────────────────────

async function runAutonomousDemo() {
  console.log("\n=== AUTONOMOUS DEMO MODE ===\n");
  console.log("The agent will perform a series of actions automatically.\n");

  const steps: { label: string; command: string; args: string[] }[] = [
    { label: "1. Initialize agent on Taiko Mainnet", command: "init", args: ["mainnet", "1.0"] },
    { label: "2. Check chain info", command: "chain", args: [] },
    { label: "3. Check wallet status", command: "status", args: [] },
    { label: "4. Get all token balances", command: "balances", args: [] },
    { label: "5. Show TaikoSwap contracts", command: "contracts", args: [] },
    { label: "6. Get swap quote: 1 ETH -> TKOSWAP", command: "quote", args: ["ETH", TAIKOSWAP_CONTRACTS.tkoswapToken, "1"] },
    { label: "7. Get swap quote: 0.1 ETH -> TKOSWAP", command: "quote", args: ["ETH", TAIKOSWAP_CONTRACTS.tkoswapToken, "0.1"] },
    { label: "8. Destroy session", command: "destroy", args: [] },
  ];

  for (const step of steps) {
    console.log(`\n--- ${step.label} ---`);
    console.log(`> ${step.command} ${step.args.join(" ")}\n`);

    const action = actions[step.command];
    if (action) {
      const result = await action.run(step.args);
      console.log(result);
    }

    // Small pause for readability
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\n=== DEMO COMPLETE ===\n");
}

// ─── Interactive REPL ──────────────────────────────────────────

async function runInteractive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`
╔═══════════════════════════════════════════════════════╗
║         Taiko Agent Toolkit — Interactive Demo        ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║  This demo simulates an AI agent operating onchain    ║
║  on the Taiko network using the Agent Toolkit.        ║
║                                                       ║
║  Type "help" for available commands.                  ║
║  Type "demo" to run the autonomous demo.              ║
║  Type "exit" to quit.                                 ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
`);

  const prompt = () => {
    const prefix = state.kit
      ? `[${state.kit.getAddress().slice(0, 8)}...] `
      : "[no-wallet] ";
    rl.question(`${prefix}> `, async (input) => {
      const trimmed = input.trim();
      if (!trimmed) { prompt(); return; }

      if (trimmed === "demo") {
        await runAutonomousDemo();
        prompt();
        return;
      }

      const [command, ...args] = trimmed.split(/\s+/);
      const action = actions[command];

      if (!action) {
        console.log(`Unknown command: ${command}. Type "help" for commands.`);
        prompt();
        return;
      }

      try {
        const result = await action.run(args);
        console.log(`\n${result}\n`);
      } catch (e: any) {
        console.log(`\nError: ${e.message}\n`);
      }

      prompt();
    });
  };

  prompt();
}

// ─── Entry Point ───────────────────────────────────────────────

const mode = process.argv[2];

if (mode === "--auto") {
  runAutonomousDemo().catch(console.error);
} else {
  runInteractive();
}
