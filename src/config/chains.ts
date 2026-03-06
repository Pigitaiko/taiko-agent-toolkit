import { defineChain } from "viem";

// === Taiko Alethia (Mainnet) ===
// L2 predeployed addresses from https://docs.taiko.xyz/network-reference/contract-addresses

export const taikoMainnet = defineChain({
  id: 167000,
  name: "Taiko Mainnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.taiko.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "Taikoscan",
      url: "https://taikoscan.io",
    },
  },
  contracts: {
    // L2 predeployed contracts
    bridge: {
      address: "0x1670000000000000000000000000000000000001" as `0x${string}`,
    },
    erc20Vault: {
      address: "0x1670000000000000000000000000000000000002" as `0x${string}`,
    },
    erc721Vault: {
      address: "0x1670000000000000000000000000000000000003" as `0x${string}`,
    },
    erc1155Vault: {
      address: "0x1670000000000000000000000000000000000004" as `0x${string}`,
    },
    signalService: {
      address: "0x1670000000000000000000000000000000000005" as `0x${string}`,
    },
    taikoAnchor: {
      address: "0x1670000000000000000000000000000000010001" as `0x${string}`,
    },
  },
});

// L1 contract addresses for Taiko Alethia on Ethereum
export const TAIKO_L1_CONTRACTS = {
  bridge: "0xd60247c6848B7Ca29eDdF63AA924E53dB6Dde8EC" as `0x${string}`,
  signalService: "0x9e0a24964e5397B566c1ed39258e21aB5E35C77C" as `0x${string}`,
  taikoToken: "0x10dea67478c5F8C5E2D90e5E9B26dBe60c54d800" as `0x${string}`,
  erc20Vault: "0x996282cA11E5DEb6B5D122CC3B9A1FcAAD4415Ab" as `0x${string}`,
  erc721Vault: "0x0b470dd3A0e1C41228856Fb319649E7c08f419Aa" as `0x${string}`,
  erc1155Vault: "0xaf145913EA4a56BE22E120ED9C24589659881702" as `0x${string}`,
  taikoInbox: "0x06a9Ab27c7e2255df1815E6CC0168d7755Feb19a" as `0x${string}`,
  composeVerifier: "0xB16931e78d0cE3c9298bbEEf3b5e2276D34b8da1" as `0x${string}`,
} as const;

// === Taiko Hoodi (Testnet) ===
// Chain ID 167013, replacing deprecated Hekla testnet

export const taikoHoodi = defineChain({
  id: 167013,
  name: "Taiko Hoodi (Testnet)",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.hoodi.taiko.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "Taikoscan Hoodi",
      url: "https://hoodi.taikoscan.io",
    },
    blockscout: {
      name: "Blockscout Hoodi",
      url: "https://blockscout.hoodi.taiko.xyz",
    },
  },
  testnet: true,
});

// === Ethereum L1 ===

export const ethereum = defineChain({
  id: 1,
  name: "Ethereum",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://eth.llamarpc.com"] },
  },
  blockExplorers: {
    default: {
      name: "Etherscan",
      url: "https://etherscan.io",
    },
  },
});

// === Chain registry ===

export type SupportedChainId = 167000 | 167013 | 1;

export const CHAIN_MAP = {
  167000: taikoMainnet,
  167013: taikoHoodi,
  1: ethereum,
} as const;

export function getChain(chainId: SupportedChainId) {
  return CHAIN_MAP[chainId];
}

// === TaikoSwap DEX (UniswapV2 fork) — verified on-chain ===

export const TAIKOSWAP_CONTRACTS = {
  router: "0xF078BD74C62a2F643fd9630ECBCfe1C3c28f4734" as `0x${string}`,
  factory: "0x278e9cbe8839a8b634bb214b58207be3743195ac" as `0x${string}`,
  tkoswapToken: "0xED197058A19E3A7C0D1aC402AaADEf22a0f31D0b" as `0x${string}`,
} as const;

// === Known tokens on Taiko Mainnet ===

export const KNOWN_TOKENS: Record<
  string,
  { address: `0x${string}`; decimals: number; symbol: string; chainId: SupportedChainId }[]
> = {
  TAIKO: [
    { address: "0x10dea67478c5F8C5E2D90e5E9B26dBe60c54d800", decimals: 18, symbol: "TAIKO", chainId: 1 },
  ],
  WETH: [
    { address: "0xA51894664A773981C6C112C43ce576f315d5b1B6", decimals: 18, symbol: "WETH", chainId: 167000 },
  ],
};
