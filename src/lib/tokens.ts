import { Token } from '@uniswap/sdk-core'
import { CHAIN_IDS, getViemChain } from './chains'
import {
  getCoinDetailsBySymbol,
  getPlatformDetailForChain
} from './coingecko'
import { getNativeCurrency } from './native-currencies'

import { createPublicClient, http, erc20Abi } from 'viem'

const TOKEN_LISTS = {
  UNISWAP: 'https://tokens.uniswap.org'
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

const SUPPORTED_CHAIN_IDS = [
  CHAIN_IDS.ETHEREUM,
  // CHAIN_IDS.BNB,
  // CHAIN_IDS.POLYGON,
  CHAIN_IDS.BASE,
  CHAIN_IDS.ARBITRUM,
  CHAIN_IDS.MEGAETH_TESTNET
]

type TokenCache = Record<number, Record<string, Token>>

let tokenCache: TokenCache | null = null
let lastFetchTime = 0
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

/**
 * Helper to prepare the in-memory token map
 */
function createEmptyTokenMap(): TokenCache {
  const map: TokenCache = {}
  SUPPORTED_CHAIN_IDS.forEach((chainId) => {
    map[chainId] = {}
  })
  return map
}

/**
 * Fetches and caches token lists from trusted sources
 */
async function fetchTokenLists(): Promise<TokenCache> {
  console.log('[TOKENS] Fetching token lists from trusted sources...')

  const tokens = createEmptyTokenMap()

  try {
    console.log('[TOKENS] Fetching Uniswap token list...')
    const uniswapResponse = await fetch(TOKEN_LISTS.UNISWAP)
    const uniswapData: TokenList = await uniswapResponse.json()

    uniswapData.tokens.forEach((token) => {
      const upperSymbol = token.symbol.toUpperCase()

      if (tokens[token.chainId]) {
        tokens[token.chainId][upperSymbol] = new Token(
          token.chainId,
          token.address,
          token.decimals,
          token.symbol,
          token.name
        )
      }

      if (token.extensions?.bridgeInfo) {
        for (const [bridgeChainId, info] of Object.entries(
          token.extensions.bridgeInfo
        )) {
          const numericChainId = Number(bridgeChainId)
          if (tokens[numericChainId] && info?.tokenAddress) {
            tokens[numericChainId][upperSymbol] = new Token(
              numericChainId,
              info.tokenAddress,
              token.decimals,
              token.symbol,
              token.name
            )
          }
        }
      }
    })

    console.log('[TOKENS] Uniswap list counts', {
      ethereum: Object.keys(tokens[CHAIN_IDS.ETHEREUM]).length,
      // polygon: Object.keys(tokens[CHAIN_IDS.POLYGON]).length,
      base: Object.keys(tokens[CHAIN_IDS.BASE]).length,
      arbitrum: Object.keys(tokens[CHAIN_IDS.ARBITRUM]).length,
      megaeth: Object.keys(tokens[CHAIN_IDS.MEGAETH_TESTNET]).length,
      // bnb: Object.keys(tokens[CHAIN_IDS.BNB]).length
    })

    console.log('[TOKENS] Token list fetching complete. Using CoinGecko for missing tokens.')
    return tokens
  } catch (error) {
    console.error('[TOKENS] Error fetching token lists:', error)
    console.log('[TOKENS] Using fallback token list')
    return getFallbackTokens()
  }
}

/**
 * Fallback tokens if fetch fails - includes popular assets
 */
function getFallbackTokens(): TokenCache {
  const map = createEmptyTokenMap()

  map[CHAIN_IDS.ETHEREUM] = {
    WETH: new Token(1, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH', 'Wrapped Ether'),
    USDC: new Token(1, '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 6, 'USDC', 'USD Coin'),
    USDT: new Token(1, '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, 'USDT', 'Tether USD'),
    DAI: new Token(1, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'Dai Stablecoin'),
    WBTC: new Token(1, '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', 8, 'WBTC', 'Wrapped Bitcoin')
  }

  // map[CHAIN_IDS.BNB] = {
  //   USDC: new Token(56, '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 18, 'USDC', 'USD Coin'),
  //   USDT: new Token(56, '0x55d398326f99059fF775485246999027B3197955', 18, 'USDT', 'Tether USD'),
  //   DAI: new Token(56, '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', 18, 'DAI', 'Dai Stablecoin'),
  //   WBNB: new Token(56, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', 18, 'WBNB', 'Wrapped BNB'),
  //   CAKE: new Token(56, '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', 18, 'CAKE', 'PancakeSwap Token')
  // }

  // map[CHAIN_IDS.POLYGON] = {
  //   WMATIC: new Token(137, '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', 18, 'WMATIC', 'Wrapped MATIC'),
  //   USDC: new Token(137, '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', 6, 'USDC', 'USD Coin'),
  //   USDT: new Token(137, '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', 6, 'USDT', 'Tether USD'),
  //   DAI: new Token(137, '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', 18, 'DAI', 'Dai Stablecoin'),
  //   WETH: new Token(137, '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', 18, 'WETH', 'Wrapped Ether')
  // }

  map[CHAIN_IDS.BASE] = {
    WETH: new Token(8453, '0x4200000000000000000000000000000000000006', 18, 'WETH', 'Wrapped Ether'),
    USDC: new Token(8453, '0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913', 6, 'USDC', 'USD Coin'),
    DAI: new Token(8453, '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', 18, 'DAI', 'Dai Stablecoin'),
    USDT: new Token(8453, '0xde3A24028580884448a5397872046a019649b084', 6, 'USDT', 'Tether USD'),
    CBETH: new Token(8453, '0xbe9895146f7af43049ca1c1ae358b0541ea49704', 18, 'cbETH', 'Coinbase Wrapped Staked ETH')
  }

  map[CHAIN_IDS.ARBITRUM] = {
    USDC: new Token(42161, '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 6, 'USDC', 'USD Coin'),
    USDT: new Token(42161, '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', 6, 'USDT', 'Tether USD'),
    DAI: new Token(42161, '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', 18, 'DAI', 'Dai Stablecoin'),
    WETH: new Token(42161, '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 18, 'WETH', 'Wrapped Ether'),
    ARB: new Token(42161, '0x912CE59144191C1204E64559FE8253a0e49E6548', 18, 'ARB', 'Arbitrum')
  }

  // MegaETH Testnet - from GTE SDK
  map[CHAIN_IDS.MEGAETH_TESTNET] = {
    WETH: new Token(6342, '0x776401b9BC8aAe31A685731B7147D4445fD9FB19', 18, 'WETH', 'Wrapped Ether'),
    USD: new Token(6342, '0xe9b6e75c243b6100ffcb1c66e8f78f96feea727f', 18, 'USD', 'USD'),
    USDC: new Token(6342, '0xd11efdcb54d3d262da188d89c31ce69d1c5828fc', 6, 'tkUSDC', 'Test USDC')
  }

  return map
}

/**
 * Gets tokens with caching and auto-refresh
 */
async function getTokens(): Promise<TokenCache> {
  const now = Date.now()

  if (tokenCache && now - lastFetchTime < CACHE_DURATION) {
    return tokenCache
  }

  tokenCache = await fetchTokenLists()
  lastFetchTime = now
  return tokenCache
}

/**
 * Get token by symbol for a specific chain
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

  const originalUpper = symbol.toUpperCase()
  if (originalUpper !== upperSymbol && chainTokens && chainTokens[originalUpper]) {
    console.log(`✓ Found ${originalUpper} on chain ${chainId}`)
    return chainTokens[originalUpper]
  }

  const fallbackToken = await loadTokenFromCoinGecko(normalized, symbol, chainId, tokens)
  if (fallbackToken) {
    return fallbackToken
  }

  console.error(`✗ Token ${symbol} (normalized: ${normalized}) not found on chain ${chainId}`)
  return undefined
}

/**
 * Get token by contract address
 */
export async function getTokenByAddress(address: string, chainId: number): Promise<Token | undefined> {
  try {
    console.log(`[TOKENS] Fetching token info for address ${address} on chain ${chainId}`)

    if (!address.startsWith('0x') || address.length !== 42) {
      console.error(`✗ Invalid address format: ${address}`)
      return undefined
    }

    const viemChain = getViemChain(chainId)
    if (!viemChain) {
      console.error(`[TOKENS] Unsupported chain for address lookup: ${chainId}`)
      return undefined
    }

    const publicClient = createPublicClient({
      chain: viemChain,
      transport: http()
    })

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

    const token = new Token(chainId, address, Number(decimals), String(symbol), String(name))
    console.log(`✓ Found token ${symbol.toString()} (${name.toString()}) at ${address} on chain ${chainId}`)

    return token
  } catch (error) {
    console.error(`✗ Error fetching token at address ${address}:`, error)
    return undefined
  }
}

export async function getTokensForChain(chainId: number): Promise<Record<string, Token>> {
  const tokens = await getTokens()
  return tokens[chainId] || {}
}

export function getSupportedChainIds(): number[] {
  return [...SUPPORTED_CHAIN_IDS]
}

export function normalizeTokenSymbol(input: string, chainId: number): string {
  const trimmed = input.trim()

  if (trimmed === '') {
    return trimmed
  }

  const lower = trimmed.toLowerCase()
  const native = getNativeCurrency(chainId)

  if (native) {
    const nativeAliases = new Set(
      [
        native.symbol,
        native.name,
        ...native.aliases
      ].map((value) => value.toLowerCase())
    )

    if (nativeAliases.has(lower)) {
      return native.symbol.toUpperCase()
    }
  }

  const normalized = trimmed.toUpperCase()

  const variations: Record<string, string> = {
    ETH: 'WETH',
    ETHEREUM: 'WETH',
    BITCOIN: 'WBTC',
    BTC: 'WBTC',
    USDCOIN: 'USDC',
    TETHER: 'USDT',
    CARDANO: 'ADA',
    MATIC: chainId === CHAIN_IDS.POLYGON ? 'WMATIC' : 'MATIC'
  }

  // if (chainId === CHAIN_IDS.BNB) {
  //   if (normalized === 'BNB') return 'WBNB'
  //   if (['WBTC', 'BTC', 'BITCOIN'].includes(normalized)) return 'BTCB'
  // }

  if (chainId === CHAIN_IDS.ARBITRUM) {
    if (normalized === 'ETHEREUM' || normalized === 'ETH') return 'WETH'
  }

  // if (chainId === CHAIN_IDS.POLYGON && normalized === 'ETH') {
  //   return 'WETH'
  // }

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

export async function preloadTokenLists(): Promise<void> {
  console.log('[TOKENS] Preloading token lists...')
  await getTokens()
}

async function loadTokenFromCoinGecko(
  normalizedSymbol: string,
  originalSymbol: string,
  chainId: number,
  tokensCache: TokenCache
): Promise<Token | undefined> {
  try {
    console.log(`[TOKENS] Attempting CoinGecko lookup for ${normalizedSymbol} on chain ${chainId}`)
    const details = await getCoinDetailsBySymbol(normalizedSymbol)

    if (!details) {
      console.log(`[TOKENS] CoinGecko did not return details for ${normalizedSymbol}`)
      return undefined
    }

    const platformDetail = getPlatformDetailForChain(details, chainId)
    if (!platformDetail || !platformDetail.contract_address) {
      console.log(`[TOKENS] CoinGecko details for ${details.name} lack contract on chain ${chainId}`)
      return undefined
    }

    const contractAddress = platformDetail.contract_address
    if (!contractAddress.startsWith('0x') || contractAddress.length !== 42) {
      console.log(`[TOKENS] CoinGecko returned invalid contract address for ${details.name}: ${contractAddress}`)
      return undefined
    }

    const decimals =
      typeof platformDetail.decimal_place === 'number' && platformDetail.decimal_place > 0
        ? platformDetail.decimal_place
        : 18

    const resolvedSymbol = (details.symbol || normalizedSymbol).toUpperCase()
    const name = details.name || resolvedSymbol
    const token = new Token(chainId, contractAddress, decimals, resolvedSymbol, name)

    const chainTokens = tokensCache[chainId] || (tokensCache[chainId] = {})

    chainTokens[resolvedSymbol] = token
    if (resolvedSymbol !== normalizedSymbol.toUpperCase()) {
      chainTokens[normalizedSymbol.toUpperCase()] = token
    }
    const originalUpper = originalSymbol.toUpperCase()
    if (originalUpper !== resolvedSymbol) {
      chainTokens[originalUpper] = token
    }

    console.log(`[TOKENS] Added ${resolvedSymbol} from CoinGecko for chain ${chainId}`)
    return token
  } catch (error) {
    console.error(`[TOKENS] CoinGecko lookup failed for ${normalizedSymbol}:`, error)
    return undefined
  }
}
