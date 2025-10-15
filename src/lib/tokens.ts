import { Token } from '@uniswap/sdk-core'
import { CHAIN_IDS } from './chains'

// Token list URLs
const TOKEN_LISTS = {
  UNISWAP: 'https://tokens.uniswap.org',
  PANCAKESWAP: 'https://tokens.pancakeswap.finance/pancakeswap-extended.json'
}

interface TokenListToken {
  chainId: number
  address: string
  name: string
  symbol: string
  decimals: number
  logoURI?: string
  extensions?: {
    bridgeInfo?: {
      [chainId: string]: {
        tokenAddress: string
      }
    }
  }
}

interface TokenList {
  name: string
  timestamp: string
  tokens: TokenListToken[]
}

// In-memory cache for token lists
let tokenCache: Record<number, Record<string, Token>> | null = null
let lastFetchTime = 0
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

/**
 * Fetches and caches token lists from trusted sources
 */
async function fetchTokenLists(): Promise<Record<number, Record<string, Token>>> {
  console.log('[TOKENS] Fetching token lists from trusted sources...')

  const tokens: Record<number, Record<string, Token>> = {
    [CHAIN_IDS.ARBITRUM]: {},
    [CHAIN_IDS.BNB]: {}
  }

  try {
    // Fetch Uniswap token list (includes Arbitrum bridged tokens)
    console.log('[TOKENS] Fetching Uniswap token list...')
    const uniswapResponse = await fetch(TOKEN_LISTS.UNISWAP)
    const uniswapData: TokenList = await uniswapResponse.json()

    // Extract Arbitrum tokens (native and bridged)
    uniswapData.tokens.forEach(token => {
      if (token.chainId === CHAIN_IDS.ARBITRUM) {
        // Native Arbitrum token
        const upperSymbol = token.symbol.toUpperCase()
        tokens[CHAIN_IDS.ARBITRUM][upperSymbol] = new Token(
          CHAIN_IDS.ARBITRUM,
          token.address,
          token.decimals,
          token.symbol,
          token.name
        )
      } else if (token.extensions?.bridgeInfo?.[String(CHAIN_IDS.ARBITRUM)]) {
        // Bridged token on Arbitrum
        const bridgeInfo = token.extensions.bridgeInfo[String(CHAIN_IDS.ARBITRUM)]
        const upperSymbol = token.symbol.toUpperCase()
        tokens[CHAIN_IDS.ARBITRUM][upperSymbol] = new Token(
          CHAIN_IDS.ARBITRUM,
          bridgeInfo.tokenAddress,
          token.decimals,
          token.symbol,
          token.name
        )
      }
    })

    console.log(`[TOKENS] Loaded ${Object.keys(tokens[CHAIN_IDS.ARBITRUM]).length} Arbitrum tokens`)

    // Fetch PancakeSwap token list (includes BNB Chain tokens)
    console.log('[TOKENS] Fetching PancakeSwap token list...')
    const pancakeResponse = await fetch(TOKEN_LISTS.PANCAKESWAP)
    const pancakeData: TokenList = await pancakeResponse.json()

    // Extract BNB Chain tokens
    pancakeData.tokens.forEach(token => {
      if (token.chainId === CHAIN_IDS.BNB) {
        const upperSymbol = token.symbol.toUpperCase()
        tokens[CHAIN_IDS.BNB][upperSymbol] = new Token(
          CHAIN_IDS.BNB,
          token.address,
          token.decimals,
          token.symbol,
          token.name
        )
      }
    })

    console.log(`[TOKENS] Loaded ${Object.keys(tokens[CHAIN_IDS.BNB]).length} BNB Chain tokens`)

    return tokens
  } catch (error) {
    console.error('[TOKENS] Error fetching token lists:', error)

    // Fallback to minimal hardcoded list
    console.log('[TOKENS] Using fallback token list')
    return getFallbackTokens()
  }
}

/**
 * Fallback tokens if fetch fails - includes most popular tokens
 */
function getFallbackTokens(): Record<number, Record<string, Token>> {
  return {
    [CHAIN_IDS.BNB]: {
      // Stablecoins
      USDC: new Token(56, '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 18, 'USDC', 'USD Coin'),
      USDT: new Token(56, '0x55d398326f99059fF775485246999027B3197955', 18, 'USDT', 'Tether USD'),
      DAI: new Token(56, '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', 18, 'DAI', 'Dai Stablecoin'),
      BUSD: new Token(56, '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', 18, 'BUSD', 'Binance USD'),
      // Major tokens
      WBNB: new Token(56, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', 18, 'WBNB', 'Wrapped BNB'),
      WETH: new Token(56, '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', 18, 'WETH', 'Wrapped Ether'),
      BTCB: new Token(56, '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', 18, 'BTCB', 'Bitcoin BEP2'),
      CAKE: new Token(56, '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', 18, 'CAKE', 'PancakeSwap Token'),
      ADA: new Token(56, '0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47', 18, 'ADA', 'Cardano Token'),
    },
    [CHAIN_IDS.ARBITRUM]: {
      // Stablecoins
      USDC: new Token(42161, '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 6, 'USDC', 'USD Coin'),
      USDT: new Token(42161, '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', 6, 'USDT', 'Tether USD'),
      DAI: new Token(42161, '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', 18, 'DAI', 'Dai Stablecoin'),
      // Major tokens
      WETH: new Token(42161, '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 18, 'WETH', 'Wrapped Ether'),
      WBTC: new Token(42161, '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', 8, 'WBTC', 'Wrapped BTC'),
      ARB: new Token(42161, '0x912CE59144191C1204E64559FE8253a0e49E6548', 18, 'ARB', 'Arbitrum'),
      GMX: new Token(42161, '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', 18, 'GMX', 'GMX'),
      UNI: new Token(42161, '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0', 18, 'UNI', 'Uniswap'),
    }
  }
}

/**
 * Gets tokens with caching and auto-refresh
 */
async function getTokens(): Promise<Record<number, Record<string, Token>>> {
  const now = Date.now()

  // Return cached tokens if still fresh
  if (tokenCache && (now - lastFetchTime) < CACHE_DURATION) {
    return tokenCache
  }

  // Fetch new token lists
  tokenCache = await fetchTokenLists()
  lastFetchTime = now

  return tokenCache
}

/**
 * Get token by symbol for a specific chain
 * This function now searches through the dynamic token list
 */
export async function getTokenBySymbol(symbol: string, chainId: number): Promise<Token | undefined> {
  const normalized = normalizeTokenSymbol(symbol, chainId)
  const upperSymbol = normalized.toUpperCase()

  const tokens = await getTokens()
  const chainTokens = tokens[chainId]

  if (chainTokens && chainTokens[upperSymbol]) {
    console.log(`✓ Found ${upperSymbol} on chain ${chainId}`)
    return chainTokens[upperSymbol]
  }

  // Try searching with original symbol (case-insensitive match)
  const originalUpper = symbol.toUpperCase()
  if (originalUpper !== upperSymbol && chainTokens && chainTokens[originalUpper]) {
    console.log(`✓ Found ${originalUpper} on chain ${chainId}`)
    return chainTokens[originalUpper]
  }

  console.error(`✗ Token ${symbol} (normalized: ${normalized}) not found on chain ${chainId}`)
  return undefined
}

/**
 * Get token by contract address
 * Fetches token details directly from the blockchain using the ERC20 contract
 */
export async function getTokenByAddress(address: string, chainId: number): Promise<Token | undefined> {
  try {
    console.log(`[TOKENS] Fetching token info for address ${address} on chain ${chainId}`)

    // Check if it's a valid address format (starts with 0x and is 42 chars)
    if (!address.startsWith('0x') || address.length !== 42) {
      console.error(`✗ Invalid address format: ${address}`)
      return undefined
    }

    // Import viem for on-chain token data fetching
    const { createPublicClient, http, erc20Abi } = await import('viem')
    const { arbitrum, bsc } = await import('viem/chains')

    const chain = chainId === 42161 ? arbitrum : bsc
    const publicClient = createPublicClient({
      chain,
      transport: http()
    })

    // Fetch token details from the contract
    const [symbol, name, decimals] = await Promise.all([
      publicClient.readContract({
        address: address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'symbol'
      }),
      publicClient.readContract({
        address: address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'name'
      }),
      publicClient.readContract({
        address: address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals'
      })
    ])

    const token = new Token(chainId, address, decimals, symbol, name)
    console.log(`✓ Found token ${symbol} (${name}) at ${address} on chain ${chainId}`)

    return token
  } catch (error) {
    console.error(`✗ Error fetching token at address ${address}:`, error)
    return undefined
  }
}

/**
 * Get all available tokens for a chain
 */
export async function getTokensForChain(chainId: number): Promise<Record<string, Token>> {
  const tokens = await getTokens()
  return tokens[chainId] || {}
}

/**
 * Get list of all supported chain IDs
 */
export function getSupportedChainIds(): number[] {
  return [CHAIN_IDS.ARBITRUM, CHAIN_IDS.BNB]
}

/**
 * Normalize token symbol to handle common variations
 */
export function normalizeTokenSymbol(input: string, chainId: number): string {
  const normalized = input.toUpperCase().trim()

  // Handle common variations and full names
  const variations: Record<string, string> = {
    'ETH': 'WETH',
    'ETHEREUM': 'WETH',
    'BITCOIN': 'WBTC',
    'BTC': 'WBTC',
    'USDCOIN': 'USDC',
    'TETHER': 'USDT',
    'CARDANO': 'ADA',
  }

  // Chain-specific variations
  if (chainId === CHAIN_IDS.BNB) {
    if (normalized === 'BNB') return 'WBNB'
    if (normalized === 'WBTC' || normalized === 'BTC' || normalized === 'BITCOIN') return 'BTCB'
  }

  if (chainId === CHAIN_IDS.ARBITRUM) {
    if (normalized === 'ETHEREUM' || normalized === 'ETH') return 'WETH'
  }

  return variations[normalized] || normalized
}

/**
 * Format token amount from human-readable to smallest unit
 */
export function formatTokenAmount(amount: string, decimals: number): bigint {
  const [whole, fraction = ''] = amount.split('.')
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(whole + paddedFraction)
}

/**
 * Parse token amount from smallest unit to human-readable
 */
export function parseTokenAmount(amount: bigint, decimals: number): string {
  const amountStr = amount.toString().padStart(decimals + 1, '0')
  const whole = amountStr.slice(0, -decimals) || '0'
  const fraction = amountStr.slice(-decimals)
  return `${whole}.${fraction}`
}

/**
 * Preload token lists (call this on app startup)
 */
export async function preloadTokenLists(): Promise<void> {
  console.log('[TOKENS] Preloading token lists...')
  await getTokens()
}
