import { Token } from '@uniswap/sdk-core'
import { CHAIN_IDS } from './chains'

// Token definitions by chain
const CHAIN_TOKENS: Record<number, Record<string, Token>> = {
  // Ethereum Mainnet (1)
  [CHAIN_IDS.ETHEREUM]: {
  WETH: new Token(
    1,
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  USDC: new Token(
    1,
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    6,
    'USDC',
    'USD Coin'
  ),
  USDT: new Token(
    1,
    '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    6,
    'USDT',
    'Tether USD'
  ),
  DAI: new Token(
    1,
    '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    18,
    'DAI',
    'Dai Stablecoin'
  ),
  WBTC: new Token(
    1,
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    8,
    'WBTC',
    'Wrapped BTC'
  ),
  UNI: new Token(
    1,
    '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    18,
    'UNI',
    'Uniswap'
  ),
  APE: new Token(
    1,
    '0x4d224452801ACEd8B2F0aebE155379bb5D594381',
    18,
    'APE',
    'ApeCoin'
  ),
  LINK: new Token(
    1,
    '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    18,
    'LINK',
    'Chainlink'
  ),
  AAVE: new Token(
    1,
    '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    18,
    'AAVE',
    'Aave'
  ),
  },

  // Arbitrum (42161)
  [CHAIN_IDS.ARBITRUM]: {
    WETH: new Token(42161, '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 18, 'WETH', 'Wrapped Ether'),
    USDC: new Token(42161, '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 6, 'USDC', 'USD Coin'),
    USDT: new Token(42161, '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', 6, 'USDT', 'Tether USD'),
    DAI: new Token(42161, '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', 18, 'DAI', 'Dai Stablecoin'),
    WBTC: new Token(42161, '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', 8, 'WBTC', 'Wrapped BTC'),
    ARB: new Token(42161, '0x912CE59144191C1204E64559FE8253a0e49E6548', 18, 'ARB', 'Arbitrum'),
  },

  // Polygon (137)
  [CHAIN_IDS.POLYGON]: {
    WETH: new Token(137, '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', 18, 'WETH', 'Wrapped Ether'),
    USDC: new Token(137, '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', 6, 'USDC', 'USD Coin'),
    USDT: new Token(137, '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', 6, 'USDT', 'Tether USD'),
    DAI: new Token(137, '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', 18, 'DAI', 'Dai Stablecoin'),
    WBTC: new Token(137, '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', 8, 'WBTC', 'Wrapped BTC'),
    MATIC: new Token(137, '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', 18, 'MATIC', 'Wrapped Matic'),
  },

  // BNB Chain (56)
  [CHAIN_IDS.BNB]: {
    WBNB: new Token(56, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', 18, 'WBNB', 'Wrapped BNB'),
    USDC: new Token(56, '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 18, 'USDC', 'USD Coin'),
    USDT: new Token(56, '0x55d398326f99059fF775485246999027B3197955', 18, 'USDT', 'Tether USD'),
    DAI: new Token(56, '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', 18, 'DAI', 'Dai Stablecoin'),
    WETH: new Token(56, '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', 18, 'WETH', 'Wrapped Ether'),
    BTCB: new Token(56, '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', 18, 'BTCB', 'Bitcoin BEP2'),
  },

  // Unichain (1301) - Using Sepolia testnet addresses as placeholder
  [CHAIN_IDS.UNICHAIN]: {
    WETH: new Token(1301, '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9', 18, 'WETH', 'Wrapped Ether'),
    USDC: new Token(1301, '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', 6, 'USDC', 'USD Coin'),
  },
};

// Legacy exports for backward compatibility
export const TOKENS = CHAIN_TOKENS[CHAIN_IDS.ETHEREUM];
export const SEPOLIA_TOKENS = CHAIN_TOKENS[CHAIN_IDS.UNICHAIN];

export async function getTokenBySymbol(symbol: string, chainId: number = 1): Promise<Token | undefined> {
  const upperSymbol = symbol.toUpperCase();

  // Strategy: Try token list FIRST (comprehensive), then hardcoded (fast fallback)
  try {
    const { findToken } = await import('./tokenlist');
    const token = await findToken(upperSymbol, chainId);
    if (token) {
      console.log(`✓ Found ${upperSymbol} on chain ${chainId} from token list`);
      return token;
    }
  } catch (error) {
    console.warn(`Token list lookup failed for ${upperSymbol} on chain ${chainId}:`, error);
  }

  // Fallback to hardcoded tokens only if token list fails
  const chainTokens = CHAIN_TOKENS[chainId];
  if (chainTokens && chainTokens[upperSymbol]) {
    console.log(`✓ Found ${upperSymbol} on chain ${chainId} from hardcoded list`);
    return chainTokens[upperSymbol];
  }

  // Last resort: try Ethereum chain if different chain was requested
  if (chainId !== CHAIN_IDS.ETHEREUM && CHAIN_TOKENS[CHAIN_IDS.ETHEREUM][upperSymbol]) {
    console.log(`⚠ Using Ethereum token for ${upperSymbol} (not found on chain ${chainId})`);
    return CHAIN_TOKENS[CHAIN_IDS.ETHEREUM][upperSymbol];
  }

  console.error(`✗ Token ${upperSymbol} not found on chain ${chainId}`);
  return undefined;
}

// Synchronous version for backward compatibility (only checks hardcoded tokens)
export function getTokenBySymbolSync(symbol: string, chainId: number = 1): Token | undefined {
  const upperSymbol = symbol.toUpperCase();
  const chainTokens = CHAIN_TOKENS[chainId];

  if (!chainTokens) {
    return CHAIN_TOKENS[CHAIN_IDS.ETHEREUM][upperSymbol];
  }

  return chainTokens[upperSymbol];
}

// Get all available tokens for a chain
export function getTokensForChain(chainId: number): Record<string, Token> {
  return CHAIN_TOKENS[chainId] || CHAIN_TOKENS[CHAIN_IDS.ETHEREUM];
}

export function normalizeTokenSymbol(input: string, chainId: number = 1): string {
  const normalized = input.toUpperCase().trim();

  // Handle common variations and full names
  const variations: Record<string, string> = {
    'ETH': 'WETH',
    'ETHEREUM': 'WETH',
    'BITCOIN': 'WBTC',
    'BTC': 'WBTC',
    'APECOIN': 'APE',
    'CHAINLINK': 'LINK',
    'USDCOIN': 'USDC',
    'TETHER': 'USDT',
  };

  // Chain-specific variations
  if (chainId === CHAIN_IDS.BNB) {
    if (normalized === 'BNB') return 'WBNB';
    if (normalized === 'WBTC' || normalized === 'BTC' || normalized === 'BITCOIN') return 'BTCB';
  }

  if (chainId === CHAIN_IDS.POLYGON) {
    if (normalized === 'POL' || normalized === 'POLYGON') return 'MATIC';
  }

  return variations[normalized] || normalized;
}

export function formatTokenAmount(amount: string, decimals: number): bigint {
  const [whole, fraction = ''] = amount.split('.')
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(whole + paddedFraction)
}

export function parseTokenAmount(amount: bigint, decimals: number): string {
  const amountStr = amount.toString().padStart(decimals + 1, '0')
  const whole = amountStr.slice(0, -decimals) || '0'
  const fraction = amountStr.slice(-decimals)
  return `${whole}.${fraction}`
}
