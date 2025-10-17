// Native currency configuration for all supported chains
export const NATIVE_CURRENCY_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export interface NativeCurrency {
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  aliases: string[]; // Common ways users might refer to it
}

export const NATIVE_CURRENCIES: Record<number, NativeCurrency> = {
  // Ethereum Mainnet
  1: {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    chainId: 1,
    aliases: ['eth', 'ethereum', 'ether'],
  },
  // Arbitrum One
  42161: {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    chainId: 42161,
    aliases: ['eth', 'ethereum', 'ether'],
  },
  // BNB Chain
  56: {
    symbol: 'BNB',
    name: 'BNB',
    decimals: 18,
    chainId: 56,
    aliases: ['bnb', 'binance coin', 'binance token'],
  },
  // Polygon
  137: {
    symbol: 'MATIC',
    name: 'Matic',
    decimals: 18,
    chainId: 137,
    aliases: ['matic', 'polygon', 'pol'],
  },
  // Base
  8453: {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    chainId: 8453,
    aliases: ['eth', 'ethereum', 'ether'],
  },
};

/**
 * Check if a token symbol/name is the native currency for a given chain
 */
export function isNativeCurrency(tokenSymbol: string, chainId: number): boolean {
  const native = NATIVE_CURRENCIES[chainId];
  if (!native) return false;

  const searchTerm = tokenSymbol.toLowerCase().trim();
  return (
    native.symbol.toLowerCase() === searchTerm ||
    native.name.toLowerCase() === searchTerm ||
    native.aliases.some((alias) => alias === searchTerm)
  );
}

/**
 * Get native currency info for a chain
 */
export function getNativeCurrency(chainId: number): NativeCurrency | undefined {
  return NATIVE_CURRENCIES[chainId];
}

/**
 * Check if an address is the native currency address
 */
export function isNativeCurrencyAddress(address: string): boolean {
  return address.toLowerCase() === NATIVE_CURRENCY_ADDRESS.toLowerCase();
}
