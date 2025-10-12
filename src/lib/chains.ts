// Chain IDs for supported networks
export const CHAIN_IDS = {
  ETHEREUM: 1,
  ARBITRUM: 42161,
  POLYGON: 137,
  BNB: 56,
  UNICHAIN: 130, // Unichain mainnet (launched Feb 2025)
} as const;

// Chain names mapping
export const CHAIN_NAMES: Record<number, string> = {
  [CHAIN_IDS.ETHEREUM]: "Ethereum",
  [CHAIN_IDS.ARBITRUM]: "Arbitrum",
  [CHAIN_IDS.POLYGON]: "Polygon",
  [CHAIN_IDS.BNB]: "BNB Chain",
  [CHAIN_IDS.UNICHAIN]: "Unichain",
};

// Detect chain ID from user input
export function detectChainFromQuery(query: string): number {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes("arbitrum") || lowerQuery.includes("arb")) {
    return CHAIN_IDS.ARBITRUM;
  }
  if (lowerQuery.includes("polygon") || lowerQuery.includes("matic")) {
    return CHAIN_IDS.POLYGON;
  }
  if (lowerQuery.includes("bnb") || lowerQuery.includes("bsc") || lowerQuery.includes("binance")) {
    return CHAIN_IDS.BNB;
  }
  if (lowerQuery.includes("unichain")) {
    return CHAIN_IDS.UNICHAIN;
  }

  // Default to Ethereum
  return CHAIN_IDS.ETHEREUM;
}

// Get chain name by ID
export function getChainName(chainId: number): string {
  return CHAIN_NAMES[chainId] || "Unknown Chain";
}
