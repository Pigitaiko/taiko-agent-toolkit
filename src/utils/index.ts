import { formatEther, formatUnits, parseEther, parseUnits } from "viem";

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function shortenHash(hash: string, chars = 6): string {
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`;
}

export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isValidTxHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

export function safeFormatEther(value: bigint): string {
  return formatEther(value);
}

export function safeParseEther(value: string): bigint {
  return parseEther(value);
}

export function safeFormatUnits(value: bigint, decimals: number): string {
  return formatUnits(value, decimals);
}

export function safeParseUnits(value: string, decimals: number): bigint {
  return parseUnits(value, decimals);
}

export function explorerTxUrl(baseUrl: string, hash: string): string {
  return `${baseUrl}/tx/${hash}`;
}

export function explorerAddressUrl(baseUrl: string, address: string): string {
  return `${baseUrl}/address/${address}`;
}
