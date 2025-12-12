import type { Chain } from "viem";
import { arbitrum, base, /* bsc, */ mainnet /*, polygon */ } from "viem/chains";
import { megaethTestnet } from "@reown/appkit/networks";

// Chain IDs for supported networks
export const CHAIN_IDS = {
  ETHEREUM: 1,
  // BNB: 56,
  POLYGON: 137,
  BASE: 8453,
  ARBITRUM: 42161,
  MEGAETH_TESTNET: 6342
} as const;

// Chain names mapping
export const CHAIN_NAMES: Record<number, string> = {
  [CHAIN_IDS.ETHEREUM]: "Ethereum",
  // [CHAIN_IDS.BNB]: "BNB Chain",
  // [CHAIN_IDS.POLYGON]: "Polygon",
  [CHAIN_IDS.BASE]: "Base",
  [CHAIN_IDS.ARBITRUM]: "Arbitrum",
  [CHAIN_IDS.MEGAETH_TESTNET]: "MegaETH Testnet"
};

// Detect chain ID from user input
export function detectChainFromQuery(query: string): number {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes("megaeth") || lowerQuery.includes("mega eth") || lowerQuery.includes("6342")) {
    return CHAIN_IDS.MEGAETH_TESTNET;
  }
  if (lowerQuery.includes("ethereum") || lowerQuery.includes("mainnet") || lowerQuery.includes("eth")) {
    return CHAIN_IDS.ETHEREUM;
  }
  if (lowerQuery.includes("arbitrum") || lowerQuery.includes("arb")) {
    return CHAIN_IDS.ARBITRUM;
  }
  // if (lowerQuery.includes("bnb") || lowerQuery.includes("bsc") || lowerQuery.includes("binance")) {
  //   return CHAIN_IDS.BNB;
  // }
  // if (lowerQuery.includes("polygon") || lowerQuery.includes("matic")) {
  //   return CHAIN_IDS.POLYGON;
  // }
  if (lowerQuery.includes("base")) {
    return CHAIN_IDS.BASE;
  }

  // Default to Ethereum
  return CHAIN_IDS.ETHEREUM;
}

// Get chain name by ID
export function getChainName(chainId: number): string {
  return CHAIN_NAMES[chainId] || "Unknown Chain";
}

export function getViemChain(chainId: number): Chain | undefined {
  switch (chainId) {
    case CHAIN_IDS.ETHEREUM:
      return mainnet;
    case CHAIN_IDS.BASE:
      return base;
    case CHAIN_IDS.ARBITRUM:
      return arbitrum;
    case CHAIN_IDS.MEGAETH_TESTNET:
      return megaethTestnet as Chain;
    default:
      return undefined;
  }
}
