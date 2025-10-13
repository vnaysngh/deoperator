// Chain IDs for supported networks (BNB Chain and Arbitrum only)
export const CHAIN_IDS = {
  BNB: 56,
  ARBITRUM: 42161,
} as const;

// Chain names mapping
export const CHAIN_NAMES: Record<number, string> = {
  [CHAIN_IDS.BNB]: "BNB Chain",
  [CHAIN_IDS.ARBITRUM]: "Arbitrum",
};

// Detect chain ID from user input
export function detectChainFromQuery(query: string): number {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes("arbitrum") || lowerQuery.includes("arb")) {
    return CHAIN_IDS.ARBITRUM;
  }
  if (lowerQuery.includes("bnb") || lowerQuery.includes("bsc") || lowerQuery.includes("binance")) {
    return CHAIN_IDS.BNB;
  }

  // Default to BNB Chain
  return CHAIN_IDS.BNB;
}

// Get chain name by ID
export function getChainName(chainId: number): string {
  return CHAIN_NAMES[chainId] || "Unknown Chain";
}
