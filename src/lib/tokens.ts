import { Token } from '@uniswap/sdk-core'
import { CHAIN_IDS } from './chains'

// Hardcoded token lists for BNB Chain and Arbitrum only
// Each chain has:
// - Base tokens (stablecoins): USDC, USDT, DAI
// - Top 5 tradable tokens by market cap
const CHAIN_TOKENS: Record<number, Record<string, Token>> = {
  // BNB Chain (56) - Top 5 tokens + stablecoins
  [CHAIN_IDS.BNB]: {
    // Base tokens (stablecoins)
    USDC: new Token(56, '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 18, 'USDC', 'USD Coin'),
    USDT: new Token(56, '0x55d398326f99059fF775485246999027B3197955', 18, 'USDT', 'Tether USD'),
    DAI: new Token(56, '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', 18, 'DAI', 'Dai Stablecoin'),
    // Top 5 tradable tokens
    WBNB: new Token(56, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', 18, 'WBNB', 'Wrapped BNB'),
    WETH: new Token(56, '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', 18, 'WETH', 'Wrapped Ether'),
    BTCB: new Token(56, '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', 18, 'BTCB', 'Bitcoin BEP2'),
    CAKE: new Token(56, '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', 18, 'CAKE', 'PancakeSwap Token'),
    ADA: new Token(56, '0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47', 18, 'ADA', 'Cardano Token'),
  },

  // Arbitrum (42161) - Top 5 tokens + stablecoins
  [CHAIN_IDS.ARBITRUM]: {
    // Base tokens (stablecoins)
    USDC: new Token(42161, '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 6, 'USDC', 'USD Coin'),
    USDT: new Token(42161, '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', 6, 'USDT', 'Tether USD'),
    DAI: new Token(42161, '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', 18, 'DAI', 'Dai Stablecoin'),
    // Top 5 tradable tokens
    WETH: new Token(42161, '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 18, 'WETH', 'Wrapped Ether'),
    WBTC: new Token(42161, '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', 8, 'WBTC', 'Wrapped BTC'),
    ARB: new Token(42161, '0x912CE59144191C1204E64559FE8253a0e49E6548', 18, 'ARB', 'Arbitrum'),
    GMX: new Token(42161, '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', 18, 'GMX', 'GMX'),
    UNI: new Token(42161, '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0', 18, 'UNI', 'Uniswap'),
  },
};

// Get token by symbol for a specific chain
export function getTokenBySymbol(symbol: string, chainId: number): Token | undefined {
  const upperSymbol = symbol.toUpperCase();
  const chainTokens = CHAIN_TOKENS[chainId];

  if (chainTokens && chainTokens[upperSymbol]) {
    console.log(`✓ Found ${upperSymbol} on chain ${chainId}`);
    return chainTokens[upperSymbol];
  }

  console.error(`✗ Token ${upperSymbol} not found on chain ${chainId}`);
  return undefined;
}

// Get all available tokens for a chain
export function getTokensForChain(chainId: number): Record<string, Token> {
  return CHAIN_TOKENS[chainId] || {};
}

// Get list of all supported chain IDs
export function getSupportedChainIds(): number[] {
  return Object.keys(CHAIN_TOKENS).map(Number);
}

export function normalizeTokenSymbol(input: string, chainId: number): string {
  const normalized = input.toUpperCase().trim();

  // Handle common variations and full names
  const variations: Record<string, string> = {
    'ETH': 'WETH',
    'ETHEREUM': 'WETH',
    'BITCOIN': 'WBTC',
    'BTC': 'WBTC',
    'USDCOIN': 'USDC',
    'TETHER': 'USDT',
    'CARDANO': 'ADA',
  };

  // Chain-specific variations
  if (chainId === CHAIN_IDS.BNB) {
    if (normalized === 'BNB') return 'WBNB';
    if (normalized === 'WBTC' || normalized === 'BTC' || normalized === 'BITCOIN') return 'BTCB';
  }

  if (chainId === CHAIN_IDS.ARBITRUM) {
    if (normalized === 'ETHEREUM' || normalized === 'ETH') return 'WETH';
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
