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

  // PancakeSwap token list - BNB Chain specific tokens including CAKE
  PANCAKESWAP: 'https://tokens.pancakeswap.finance/pancakeswap-extended.json',

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
 * Get token list with caching - merges multiple sources
 */
export async function getTokenList(): Promise<TokenList> {
  // Return cached version if still valid
  const now = Date.now();
  if (tokenListCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return tokenListCache;
  }

  const mergedTokens: TokenInfo[] = [];
  const seenTokens = new Set<string>(); // Track by chainId:address

  // Fetch from all sources and merge
  const sources = [
    { name: 'Uniswap', url: TOKEN_LIST_SOURCES.UNISWAP },
    { name: 'PancakeSwap', url: TOKEN_LIST_SOURCES.PANCAKESWAP },
  ];

  for (const source of sources) {
    try {
      console.log(`Fetching token list from ${source.name}...`);
      const list = await fetchTokenList(source.url);

      // Add unique tokens
      for (const token of list.tokens) {
        const key = `${token.chainId}:${token.address.toLowerCase()}`;
        if (!seenTokens.has(key)) {
          seenTokens.add(key);
          mergedTokens.push(token);
        }
      }

      console.log(`✓ Added ${list.tokens.length} tokens from ${source.name}`);
    } catch (error) {
      console.warn(`${source.name} token list failed:`, error);
    }
  }

  if (mergedTokens.length === 0) {
    // Last resort: try CoinGecko
    try {
      console.log('Trying CoinGecko as last resort...');
      const list = await fetchTokenList(TOKEN_LIST_SOURCES.COINGECKO);
      mergedTokens.push(...list.tokens);
      console.log(`✓ Loaded ${list.tokens.length} tokens from CoinGecko`);
    } catch (error) {
      console.error('All token list sources failed:', error);
      throw new Error('Failed to fetch token list from all sources');
    }
  }

  // Create merged token list
  const mergedList: TokenList = {
    name: 'Merged Token List',
    timestamp: new Date().toISOString(),
    version: { major: 1, minor: 0, patch: 0 },
    tokens: mergedTokens,
  };

  tokenListCache = mergedList;
  cacheTimestamp = now;
  console.log(`✓ Total merged tokens: ${mergedTokens.length}`);

  return mergedList;
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
 * Returns the first exact match by symbol
 */
export async function searchTokenBySymbolAndChain(
  symbol: string,
  chainId: number
): Promise<TokenInfo | null> {
  const tokenList = await getTokenList();
  const upperSymbol = symbol.toUpperCase();

  // Find ALL tokens with matching symbol on this chain
  const matches = tokenList.tokens.filter(
    token => token.symbol.toUpperCase() === upperSymbol && token.chainId === chainId
  );

  if (matches.length === 0) {
    return null;
  }

  if (matches.length === 1) {
    return matches[0];
  }

  // Multiple matches - try to find the most canonical one
  // Prefer tokens without "Wormhole", "Bridge", "Portal" in name
  const canonical = matches.find(
    token =>
      !token.name.toLowerCase().includes('wormhole') &&
      !token.name.toLowerCase().includes('bridge') &&
      !token.name.toLowerCase().includes('portal') &&
      !token.name.toLowerCase().includes('(old)') &&
      !token.name.toLowerCase().includes('deprecated')
  );

  if (canonical) {
    console.log(`✓ Found canonical ${upperSymbol}: ${canonical.name} (${canonical.address})`);
    return canonical;
  }

  // If all are bridge tokens, just return the first one
  console.log(`⚠️  Multiple ${upperSymbol} tokens found on chain ${chainId}, using first: ${matches[0].name}`);
  return matches[0];
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
 * Simply returns the token if found on the requested chain
 */
export async function findToken(
  symbol: string,
  chainId: number
): Promise<Token | null> {
  const upperSymbol = symbol.toUpperCase();

  const tokenInfo = await searchTokenBySymbolAndChain(upperSymbol, chainId);

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
