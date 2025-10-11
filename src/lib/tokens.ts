import { Token } from '@uniswap/sdk-core'

// Common token addresses on Ethereum Mainnet
export const TOKENS: Record<string, Token> = {
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
}

// Sepolia testnet tokens
export const SEPOLIA_TOKENS: Record<string, Token> = {
  WETH: new Token(
    11155111,
    '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  USDC: new Token(
    11155111,
    '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    6,
    'USDC',
    'USD Coin'
  ),
}

export function getTokenBySymbol(symbol: string, chainId: number = 1): Token | undefined {
  const upperSymbol = symbol.toUpperCase()

  if (chainId === 11155111) {
    return SEPOLIA_TOKENS[upperSymbol]
  }

  return TOKENS[upperSymbol]
}

export function normalizeTokenSymbol(input: string): string {
  const normalized = input.toUpperCase().trim()

  // Handle common variations
  const variations: Record<string, string> = {
    'ETH': 'WETH',
    'ETHEREUM': 'WETH',
    'BITCOIN': 'WBTC',
    'BTC': 'WBTC',
  }

  return variations[normalized] || normalized
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
