import { getTokenBySymbol } from './tokens'

const MORALIS_PRICE_API_BASE_URL = 'https://deep-index.moralis.io/api/v2.2/erc20'

const MORALIS_CHAIN_MAP: Record<number, string> = {
  [1]: 'eth',
  [56]: 'bsc',
  [137]: 'polygon',
  [8453]: 'base',
  [42161]: 'arbitrum'
}

export async function getTokenUSDPrice(
  tokenSymbol: string,
  chainId: number
): Promise<{
  success: boolean
  price?: string
  priceNumber?: number
  symbol?: string
  tokenAddress?: string
  error?: string
  userMessage?: string
}> {
  try {
    console.log('[PRICES] getTokenUSDPrice()', { tokenSymbol, chainId })

    const moralisChain = MORALIS_CHAIN_MAP[chainId]

    if (!moralisChain) {
      console.warn('[PRICES] Unsupported chain for Moralis price lookup', { chainId })
      return {
        success: false,
        error: 'Chain not supported',
        userMessage:
          'I can only fetch prices on Ethereum, BNB Chain, Polygon, Base, or Arbitrum right now. Want to try one of those networks?'
      }
    }

    const apiKey = process.env.MORALIS_API_KEY
    if (!apiKey) {
      console.error('[PRICES] Missing MORALIS_API_KEY')
      return {
        success: false,
        error: 'MORALIS_API_KEY is missing',
        userMessage:
          'Price lookups are unavailable at the moment. Please try again in a bit!'
      }
    }

    const normalizedInput = tokenSymbol.trim()
    const lowerInput = normalizedInput.toLowerCase()
    const looksLikeAddress = lowerInput.startsWith('0x') && lowerInput.length === 42

    let tokenAddress = lowerInput
    let resolvedSymbol = normalizedInput.toUpperCase()

    if (!looksLikeAddress) {
      const token = await getTokenBySymbol(normalizedInput, chainId)

      if (!token) {
        console.warn('[PRICES] Token not found for price lookup', {
          tokenSymbol: normalizedInput,
          chainId
        })
        return {
          success: false,
          error: 'Token not found',
          userMessage: `I couldn't find ${normalizedInput} on this chain. Could you double-check the token symbol or share the contract address?`
        }
      }

      tokenAddress = token.address.toLowerCase()
      resolvedSymbol = token.symbol ?? resolvedSymbol
    }

    const url = `${MORALIS_PRICE_API_BASE_URL}/${tokenAddress}/price?chain=${moralisChain}`
    console.log('[PRICES] Requesting price from Moralis', {
      url,
      moralisChain,
      resolvedSymbol,
      looksLikeAddress
    })
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-API-Key': apiKey
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[PRICES] Moralis price API returned error', {
        status: response.status,
        errorText
      })
      return {
        success: false,
        error: `Moralis price API error ${response.status}: ${errorText}`,
        userMessage:
          'Having trouble getting the price right now. Want to try another token or check again in a minute?'
      }
    }

    interface MoralisPriceResponse {
      tokenSymbol?: string
      tokenAddress?: string
      usdPrice?: number
      usdPriceFormatted?: string
    }

    const data: MoralisPriceResponse = await response.json()
    console.log('[PRICES] Moralis response received', {
      tokenSymbol: data.tokenSymbol,
      usdPrice: data.usdPrice,
      usdPriceFormatted: data.usdPriceFormatted
    })

    const usdPrice =
      typeof data.usdPrice === 'number'
        ? data.usdPrice
        : typeof data.usdPriceFormatted === 'string'
        ? parseFloat(data.usdPriceFormatted.replace(/[^0-9.-]/g, ''))
        : undefined

    if (usdPrice === undefined || Number.isNaN(usdPrice)) {
      console.warn('[PRICES] Moralis returned invalid price format', { data })
      return {
        success: false,
        error: 'Invalid response format',
        userMessage:
          'Got an unexpected response from the price service. Should we try again?'
      }
    }

    if (looksLikeAddress && data.tokenSymbol) {
      resolvedSymbol = data.tokenSymbol
    }

    const formattedPrice =
      usdPrice >= 1
        ? usdPrice.toFixed(2)
        : usdPrice >= 0.01
        ? usdPrice.toFixed(4)
        : usdPrice.toPrecision(3)

    console.log('[PRICES] USD price computed', {
      resolvedSymbol,
      usdPrice,
      formattedPrice
    })

    return {
      success: true,
      price: formattedPrice,
      priceNumber: usdPrice,
      symbol: resolvedSymbol,
      tokenAddress: data.tokenAddress?.toLowerCase() ?? tokenAddress
    }
  } catch (error) {
    console.error('[PRICES] Error fetching token USD price', {
      error: error instanceof Error ? error.message : error,
      tokenSymbol,
      chainId
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      userMessage:
        'Having trouble connecting to the price service. Let’s try again shortly!'
    }
  }
}
