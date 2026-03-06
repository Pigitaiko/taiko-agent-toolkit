# Taiko Agent Toolkit

**The onchain toolkit built for the agent economy on Taiko.**

Give your AI agents superpowers on Taiko — the Ethereum-equivalent (Type 1) ZK-rollup. Session-scoped wallets, token operations, swaps via TaikoSwap, L1/L2 bridging, and onchain agent identity — all in one SDK.

---

## Why Taiko Agent Toolkit?

Building AI agents that interact onchain is painful. You need to wire together wallet libraries, gas abstraction, swap APIs, bridge protocols, and identity systems — all from scratch.

**Taiko Agent Toolkit consolidates everything into a single SDK and CLI**, purpose-built for AI agents operating on Taiko.

| Problem | Solution |
|---|---|
| Agents need wallets with guardrails | Session-scoped wallets with spending limits, TTL, and contract allowlists |
| Private keys leak via prompt injection | Keys are AES-256 encrypted, never exposed to agent context |
| Swapping tokens requires complex integrations | One-line swaps via TaikoSwap (native Uniswap V2 DEX) |
| Bridging between L1 and L2 is fragmented | Built-in ETH bridging through Taiko's native bridge |
| No way to verify an agent's track record | Onchain agent identity and reputation registry (ERC-8004 inspired) |
| Every framework needs different glue code | Framework-agnostic SDK — works with Claude, LangChain, CrewAI, or anything |

---

## Features

### Session-Scoped Wallets
Create wallets that auto-expire and enforce spending limits. Private keys are encrypted with AES-256 and PBKDF2 — they never enter the agent's context window.

```typescript
import { TaikoAgentKit } from "@taiko/agent-toolkit";

const kit = TaikoAgentKit.create({
  chainId: 167000,
  walletConfig: {
    spendingLimitEth: "0.5",  // Max 0.5 ETH per session
    ttlSeconds: 3600,          // Wallet expires in 1 hour
    allowedContracts: ["0x..."], // Only interact with approved contracts
  },
});
```

### Token Operations
Query balances and transfer ETH or any ERC-20 token.

```typescript
// Get all token balances
const balances = await kit.getAllBalances();

// Transfer ETH
await kit.transfer({ to: "0x...", amount: "0.01" });

// Transfer ERC-20
await kit.transfer({ to: "0x...", amount: "100", token: "USDC" });
```

### TaikoSwap Integration
Swap tokens directly through TaikoSwap, the native DEX on Taiko (Uniswap V2 fork).

```typescript
// Get a quote
const quote = await kit.getSwapQuote({
  fromToken: "ETH",
  toToken: "TAIKO",
  amount: "1.0",
  slippageBps: 50, // 0.5%
});

// Execute the swap
const result = await kit.swap({
  fromToken: "ETH",
  toToken: "TAIKO",
  amount: "1.0",
});
```

### L1/L2 Bridging
Bridge ETH between Ethereum and Taiko through the native bridge contracts.

```typescript
// Bridge ETH from Taiko L2 -> Ethereum L1
await kit.bridge({
  amount: "0.5",
  toChain: 1,
});
```

### Onchain Agent Identity
Register your agent onchain with metadata, capabilities, and a verifiable reputation score.

```typescript
// Register your agent
const { agentId } = await kit.registerAgent({
  name: "my-trading-agent",
  description: "Automated DeFi agent on Taiko",
  version: "1.0.0",
  capabilities: ["swap", "bridge", "monitor"],
  framework: "langchain",
});

// Query agent reputation
const info = await kit.getAgentInfo("my-trading-agent");
console.log(info.reputation); // Reputation score based on onchain outcomes
```

### Chain Queries
Query Taiko chain state — blocks, gas prices, transactions, and arbitrary contract reads.

```typescript
const info = await kit.getChainInfo();
// { name: "Taiko Mainnet", chainId: 167000, blockNumber: "4665828", gasPrice: "0.15 gwei", ... }

const block = await kit.getBlockNumber();
```

---

## CLI

The toolkit includes a CLI for quick operations and testing.

```bash
# Install globally
npm install -g @taiko/agent-toolkit

# Initialize a new agent
taiko-agent init --name my-agent

# Wallet management
taiko-agent wallet create --limit 0.5 --chain 167000
taiko-agent wallet list
taiko-agent wallet info 0x...

# Token operations
taiko-agent tokens balances 0x...
taiko-agent tokens send --wallet 0x... --to 0x... --amount 0.01

# Swap via TaikoSwap
taiko-agent swap quote --from ETH --to TAIKO --amount 1.0
taiko-agent swap execute --wallet 0x... --from ETH --to TAIKO --amount 0.1

# Chain info
taiko-agent chain info
taiko-agent chain gas
taiko-agent chain block
```

---

## Supported Networks

| Network | Chain ID | Status |
|---|---|---|
| **Taiko Mainnet (Alethia)** | 167000 | Production |
| **Taiko Hoodi (Testnet)** | 167013 | Testnet |
| **Ethereum L1** | 1 | Bridging |

---

## Architecture

```
@taiko/agent-toolkit          <-- Core SDK + CLI (this package)
  |
  ├── wallet/                  Session-scoped wallets with encryption
  ├── tokens/                  ERC-20 balances & transfers
  ├── swap/                    TaikoSwap (UniswapV2) integration
  ├── bridge/                  Taiko native bridge (L1 <-> L2)
  ├── identity/                Onchain agent registry & reputation
  ├── rpc/                     Chain queries & contract reads
  └── config/                  Chain configs & verified addresses

@taiko/agent-toolkit-langchain <-- Thin adapter (coming soon)
@taiko/agent-toolkit-mcp       <-- Thin adapter (coming soon)
```

The SDK is **framework-agnostic by design**. It exposes plain TypeScript functions that any AI agent framework can call. Framework-specific adapters (LangChain tools, Claude MCP servers, CrewAI tools) are thin wrappers that will be published as separate packages.

---

## Verified Contract Addresses

All contract addresses are verified on-chain.

### TaikoSwap (Native DEX)
| Contract | Address |
|---|---|
| Router (UniswapV2Router02) | `0xF078BD74C62a2F643fd9630ECBCfe1C3c28f4734` |
| Factory (UniswapV2Factory) | `0x278e9cbe8839a8b634bb214b58207be3743195ac` |
| TKOSWAP Token | `0xED197058A19E3A7C0D1aC402AaADEf22a0f31D0b` |

### Taiko L2 (Predeployed)
| Contract | Address |
|---|---|
| Bridge | `0x1670000000000000000000000000000000000001` |
| ERC20Vault | `0x1670000000000000000000000000000000000002` |
| ERC721Vault | `0x1670000000000000000000000000000000000003` |
| ERC1155Vault | `0x1670000000000000000000000000000000000004` |
| SignalService | `0x1670000000000000000000000000000000000005` |
| WETH | `0xA51894664A773981C6C112C43ce576f315d5b1B6` |

### Taiko L1 (Ethereum)
| Contract | Address |
|---|---|
| Bridge | `0xd60247c6848B7Ca29eDdF63AA924E53dB6Dde8EC` |
| TaikoToken | `0x10dea67478c5F8C5E2D90e5E9B26dBe60c54d800` |
| TaikoInbox | `0x06a9Ab27c7e2255df1815E6CC0168d7755Feb19a` |
| ERC20Vault | `0x996282cA11E5DEb6B5D122CC3B9A1FcAAD4415Ab` |
| SignalService | `0x9e0a24964e5397B566c1ed39258e21aB5E35C77C` |

---

## Security Model

The toolkit is designed with agent-specific threat modeling:

- **Encrypted key storage** — Private keys are encrypted with AES-256-CBC + PBKDF2 (100k iterations). Keys never enter the agent's prompt or context window.
- **Spending limits** — Every session wallet has a configurable ETH spending cap. Transactions that exceed the limit are rejected.
- **Time-to-live** — Wallets auto-expire. Expired wallets cannot sign transactions.
- **Contract allowlists** — Optionally restrict which contracts the agent can interact with, preventing rogue interactions.
- **Transaction preview** — Quote swaps and estimate gas before committing.

---

## Quick Start

```bash
# Install
npm install @taiko/agent-toolkit

# Or use the CLI
npx @taiko/agent-toolkit init --name my-agent --chain 167000
```

```typescript
import { TaikoAgentKit } from "@taiko/agent-toolkit";

// Create a new agent session
const kit = TaikoAgentKit.create({
  chainId: 167000, // Taiko Mainnet
  walletConfig: {
    spendingLimitEth: "0.1",
    ttlSeconds: 3600,
  },
});

// Fund the wallet, then:
console.log(`Agent wallet: ${kit.getAddress()}`);
console.log(`Balance: ${await kit.getBalance()} ETH`);

// Swap 0.01 ETH for TAIKO tokens via TaikoSwap
await kit.swap({ fromToken: "ETH", toToken: "TAIKO", amount: "0.01" });

// Clean up when done
kit.destroy();
```

---

## Solidity: Agent Registry

The `contracts/AgentRegistry.sol` contract provides onchain identity and reputation for AI agents. Deploy it on Taiko to enable:

- Agent registration with JSON metadata
- Reputation tracking (success/failure reports)
- Agent discovery by owner address
- Deactivation for retired agents

---

## Contributing

Contributions welcome. Please open an issue or PR.

## License

MIT
