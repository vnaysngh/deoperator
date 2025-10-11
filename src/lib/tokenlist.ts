/**
 * Token List Integration
 * Uses multiple reliable sources for token data:
 * 1. Uniswap Labs token list (primary - supports 20+ chains including Ethereum, Arbitrum, Polygon, BNB, Base, Optimism, Avalanche)
 * 2. CoinGecko token list (fallback - Ethereum mainnet only)
 * 3. In-memory caching (1 hour TTL) for performance
 */

import { Token } from '@uniswap/sdk-core';

// Token list sources
const TOKEN_LIST_SOURCES = {
  // Uniswap Labs Default - Most comprehensive, supports 20+ chains
  // Chains: Ethereum (1), Optimism (10), BNB (56), Polygon (137), Arbitrum (42161), Base (8453), Avalanche (43114), etc.
  UNISWAP: 'https://tokens.uniswap.org',

  // CoinGecko as fallback (only supports Ethereum mainnet)
  COINGECKO: 'https://tokens.coingecko.com/uniswap/all.json',
};

export interface TokenInfo {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

export interface TokenList {
  name: string;
  timestamp: string;
  version: {
    major: number;
    minor: number;
    patch: number;
  };
  tokens: TokenInfo[];
}

// In-memory cache
let tokenListCache: TokenList | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

/**
 * Fetch token list from remote source
 */
async function fetchTokenList(url: string): Promise<TokenList> {
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch token list: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching token list from ${url}:`, error);
    throw error;
  }
}

/**
 * Get token list with caching
 */
export async function getTokenList(): Promise<TokenList> {
  // Return cached version if still valid
  const now = Date.now();
  if (tokenListCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return tokenListCache;
  }

  // Try primary source (Uniswap - supports 20+ chains)
  try {
    console.log('Fetching token list from Uniswap Labs...');
    const list = await fetchTokenList(TOKEN_LIST_SOURCES.UNISWAP);
    tokenListCache = list;
    cacheTimestamp = now;
    console.log(`✓ Loaded ${list.tokens.length} tokens from Uniswap`);
    return list;
  } catch (error) {
    console.warn('Uniswap token list failed, trying CoinGecko...', error);
  }

  // Try fallback (CoinGecko - only Ethereum mainnet)
  try {
    console.log('Fetching token list from CoinGecko...');
    const list = await fetchTokenList(TOKEN_LIST_SOURCES.COINGECKO);
    tokenListCache = list;
    cacheTimestamp = now;
    console.log(`✓ Loaded ${list.tokens.length} tokens from CoinGecko (Ethereum only)`);
    return list;
  } catch (error) {
    console.error('All token list sources failed:', error);
    throw new Error('Failed to fetch token list from all sources');
  }
}

/**
 * Search for a token by symbol
 * Returns all tokens matching the symbol across all chains
 */
export async function searchTokenBySymbol(symbol: string): Promise<TokenInfo[]> {
  const tokenList = await getTokenList();
  const upperSymbol = symbol.toUpperCase();

  return tokenList.tokens.filter(
    token => token.symbol.toUpperCase() === upperSymbol
  );
}

/**
 * Search for a token by symbol on a specific chain
 */
export async function searchTokenBySymbolAndChain(
  symbol: string,
  chainId: number
): Promise<TokenInfo | null> {
  const tokenList = await getTokenList();
  const upperSymbol = symbol.toUpperCase();

  const token = tokenList.tokens.find(
    token => token.symbol.toUpperCase() === upperSymbol && token.chainId === chainId
  );

  return token || null;
}

/**
 * Convert TokenInfo to Uniswap SDK Token
 */
export function toUniswapToken(tokenInfo: TokenInfo): Token {
  return new Token(
    tokenInfo.chainId,
    tokenInfo.address,
    tokenInfo.decimals,
    tokenInfo.symbol,
    tokenInfo.name
  );
}

/**
 * Search and return Uniswap SDK Token
 */
export async function findToken(
  symbol: string,
  chainId: number
): Promise<Token | null> {
  const tokenInfo = await searchTokenBySymbolAndChain(symbol, chainId);

  if (!tokenInfo) {
    return null;
  }

  return toUniswapToken(tokenInfo);
}

/**
 * Get all available tokens for a chain
 */
export async function getTokensForChain(chainId: number): Promise<TokenInfo[]> {
  const tokenList = await getTokenList();
  return tokenList.tokens.filter(token => token.chainId === chainId);
}

/**
 * Check if a token exists in the list
 */
export async function tokenExists(
  symbol: string,
  chainId: number
): Promise<boolean> {
  const token = await searchTokenBySymbolAndChain(symbol, chainId);
  return token !== null;
}

/**
 * Get token by address
 */
export async function getTokenByAddress(
  address: string,
  chainId: number
): Promise<TokenInfo | null> {
  const tokenList = await getTokenList();
  const lowerAddress = address.toLowerCase();

  const token = tokenList.tokens.find(
    token =>
      token.address.toLowerCase() === lowerAddress &&
      token.chainId === chainId
  );

  return token || null;
}

/**
 * Clear cache (useful for testing or forcing refresh)
 */
export function clearTokenListCache(): void {
  tokenListCache = null;
  cacheTimestamp = 0;
}
