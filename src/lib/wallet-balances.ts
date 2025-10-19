import { Token } from '@uniswap/sdk-core'
import { getTokenUSDPrice } from './prices'
import { type PublicClient, type Address, erc20Abi, formatUnits } from 'viem'

export interface TokenBalance {
  token: Token
  balance: string // Human-readable balance (e.g., "10.5")
  balanceRaw: bigint // Raw balance in smallest unit
  usdValue?: number // USD value if available
  usdPrice?: number // Price per token in USD
}

/**
 * Fetches the balance of a specific token for an address
 */
export async function getTokenBalance(
  publicClient: PublicClient,
  tokenAddress: Address,
  walletAddress: Address,
  decimals: number
): Promise<{ balance: string; balanceRaw: bigint }> {
  try {
    // Check if it's native token (zero address)
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      const balance = await publicClient.getBalance({ address: walletAddress })
      return {
        balance: formatUnits(balance, decimals),
        balanceRaw: balance
      }
    }

    // ERC20 token
    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [walletAddress]
    })

    return {
      balance: formatUnits(balance, decimals),
      balanceRaw: balance
    }
  } catch (error) {
    console.error(`[WALLET] Error fetching balance for ${tokenAddress}:`, error)
    return {
      balance: '0',
      balanceRaw: BigInt(0)
    }
  }
}

/**
 * Fetches ALL token balances using Moralis blockchain indexer API
 * This discovers tokens the user actually holds, not just checking a predefined list
 */
async function fetchTokenBalancesFromIndexer(
  walletAddress: Address,
  chainId: number
): Promise<Array<{
  address: string;
  balance: string;
  decimals: number;
  symbol?: string;
  name?: string;
  usdPrice?: number;
  usdValue?: number;
}>> {
  try {
    // Map chain IDs to Moralis chain names
    const chainMap: Record<number, string> = {
      1: 'eth',
      // 56: 'bsc',
      8453: 'base',
      42161: 'arbitrum'
    }

    const chain = chainMap[chainId]
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`)
    }

    console.log(`[WALLET] Fetching token holdings from Moralis API for ${walletAddress} on ${chain}`)

    const moralisApiKey = process.env.MORALIS_API_KEY
    if (!moralisApiKey) {
      throw new Error('MORALIS_API_KEY not found in environment variables')
    }

    const response = await fetch(
      `https://deep-index.moralis.io/api/v2.2/wallets/${walletAddress}/tokens?chain=${chain}&limit=100`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-API-Key': moralisApiKey
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Moralis API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const result = data.result || []

    console.log(`[WALLET] Found ${result.length} tokens from Moralis`)

    // Map Moralis response to our format
    // Filter out native tokens (e.g., ETH) and tokens with USD value below $0.01
    interface MoralisToken {
      native_token?: boolean;
      usd_value?: string;
      token_address: string;
      balance?: string;
      balance_formatted?: string;
      decimals: string | number;
      symbol?: string;
      name?: string;
      usd_price?: string;
    }

    const tokens = result
      .filter((token: MoralisToken) => {
        // Exclude native tokens
        if (token.native_token) return false

        // Only include tokens with USD value >= $0.01
        const usdValue = parseFloat(token.usd_value || '0')
        return usdValue >= 0.01
      })
      .map((token: MoralisToken) => {
        const decimals = typeof token.decimals === 'number' ? token.decimals : parseInt(token.decimals) || 18

        // Use balance_formatted if available, otherwise calculate from balance
        let balanceFormatted: string
        if (token.balance_formatted) {
          balanceFormatted = token.balance_formatted
        } else {
          const balanceRaw = token.balance || '0'
          const balanceNum = parseFloat(balanceRaw) / Math.pow(10, decimals)
          balanceFormatted = balanceNum.toString()
        }

        return {
          address: token.token_address,
          balance: balanceFormatted,
          decimals: decimals,
          symbol: token.symbol,
          name: token.name,
          usdPrice: parseFloat(token.usd_price || '0'),
          usdValue: parseFloat(token.usd_value || '0')
        }
      })
      .sort((a: { usdValue: number }, b: { usdValue: number }) => (b.usdValue || 0) - (a.usdValue || 0)) // Sort by USD value (highest first)

    return tokens
  } catch (error) {
    console.error('[WALLET] Error fetching from Moralis indexer:', error)
    throw error
  }
}

/**
 * Fetches balances for all tokens on a specific chain
 * Uses blockchain indexer API to discover ALL tokens the user holds
 */
export async function getAllTokenBalances(
  publicClient: PublicClient,
  walletAddress: Address,
  chainId: number,
  options: {
    includeZeroBalances?: boolean
    minUsdValue?: number
    maxResults?: number
  } = {}
): Promise<TokenBalance[]> {
  const {
    includeZeroBalances = false,
    minUsdValue,
    maxResults = 20
  } = options

  console.log(`[WALLET] Fetching ALL token balances for ${walletAddress} on chain ${chainId}`)

  try {
    // Fetch actual token holdings from indexer API
    const indexerTokens = await fetchTokenBalancesFromIndexer(walletAddress, chainId)

    console.log(`[WALLET] Processing ${indexerTokens.length} tokens from indexer...`)

    // Convert indexer tokens to Token objects and create TokenBalance entries
    const allBalances: TokenBalance[] = []

    for (const indexerToken of indexerTokens) {
      try {
        // Parse the balance from indexer (already in human-readable format)
        const balanceNum = parseFloat(indexerToken.balance)

        // Skip zero balances if requested
        if (!includeZeroBalances && balanceNum === 0) {
          continue
        }

        // Convert balance to raw format (smallest unit)
        const balanceRaw = BigInt(Math.floor(balanceNum * Math.pow(10, indexerToken.decimals)))

        // Create Token object
        const token = new Token(
          chainId,
          indexerToken.address,
          indexerToken.decimals,
          indexerToken.symbol || 'UNKNOWN',
          indexerToken.name || 'Unknown Token'
        )

        allBalances.push({
          token,
          balance: indexerToken.balance,
          balanceRaw,
          usdPrice: indexerToken.usdPrice,
          usdValue: indexerToken.usdValue
        })
      } catch (err) {
        console.log(`[WALLET] Skipping token ${indexerToken.symbol || indexerToken.address}: processing error`, err)
      }
    }

    console.log(`[WALLET] Found ${allBalances.length} tokens with non-zero balances`)

    // USD prices and values are already included from Moralis API
    // No need to fetch separately

    // Apply USD value filter if specified
    let filteredResults = allBalances
    if (minUsdValue !== undefined) {
      filteredResults = allBalances.filter(r =>
        r.usdValue !== undefined && r.usdValue >= minUsdValue
      )
    }

    // Sort by USD value (descending), then by balance
    filteredResults.sort((a, b) => {
      const aValue = a.usdValue || 0
      const bValue = b.usdValue || 0
      if (bValue !== aValue) {
        return bValue - aValue
      }
      // If USD values are equal (both 0 or undefined), sort by raw balance
      return Number(b.balanceRaw - a.balanceRaw)
    })

    // Apply max results limit
    filteredResults = filteredResults.slice(0, maxResults)

    console.log(`[WALLET] Returning ${filteredResults.length} tokens`)

    return filteredResults
  } catch (error) {
    console.error('[WALLET] Error fetching token balances:', error)
    throw error
  }
}

/**
 * Fetches balances for specific tokens
 */
export async function getSpecificTokenBalances(
  publicClient: PublicClient,
  walletAddress: Address,
  tokens: Token[]
): Promise<TokenBalance[]> {
  console.log(`[WALLET] Fetching balances for ${tokens.length} specific tokens`)

  const results = await Promise.all(
    tokens.map(async (token) => {
      try {
        const { balance, balanceRaw } = await getTokenBalance(
          publicClient,
          token.address as Address,
          walletAddress,
          token.decimals
        )

        const tokenBalance: TokenBalance = {
          token,
          balance,
          balanceRaw
        }

        // Fetch USD price if balance > 0
        if (balanceRaw > BigInt(0)) {
          try {
            const priceResult = await getTokenUSDPrice(token.symbol || '', token.chainId)
            if (priceResult.success) {
              const { priceNumber, price } = priceResult
              let usdPrice: number | undefined = priceNumber

              if (usdPrice === undefined && price) {
                usdPrice = parseFloat(price)
              }

              if (usdPrice !== undefined && !Number.isNaN(usdPrice)) {
                tokenBalance.usdPrice = usdPrice
                tokenBalance.usdValue = parseFloat(balance) * usdPrice
              }
            }
          } catch {
            // Price fetch failed, continue without USD value
          }
        }

        return tokenBalance
      } catch (error) {
        console.error(`[WALLET] Error processing ${token.symbol}:`, error)
        return null
      }
    })
  )

  return results.filter((r): r is TokenBalance => r !== null)
}

/**
 * Calculate total portfolio value in USD
 */
export function calculatePortfolioValue(balances: TokenBalance[]): number {
  return balances.reduce((total, balance) => {
    return total + (balance.usdValue || 0)
  }, 0)
}

/**
 * Format token balance for display
 */
export function formatTokenBalance(balance: TokenBalance): string {
  const { token, balance: amount, usdValue } = balance

  if (usdValue !== undefined) {
    return `${parseFloat(amount).toFixed(6)} ${token.symbol} ($${usdValue.toFixed(2)})`
  }

  return `${parseFloat(amount).toFixed(6)} ${token.symbol}`
}
