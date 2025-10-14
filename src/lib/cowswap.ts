/**
 * CoW Protocol (CowSwap) API Client
 * Intent-based swap protocol using batch auctions
 *
 * Supported Chains:
 * - Arbitrum (chainId: 42161)
 * - BNB Chain (chainId: 56)
 *
 * API Documentation: https://docs.cow.fi/cow-protocol/reference/apis/orderbook
 * OpenAPI Spec: https://github.com/cowprotocol/services/blob/main/crates/orderbook/openapi.yml
 */

import { getTokenBySymbol, formatTokenAmount } from './tokens';

// CoW Protocol API base URLs
const COW_API_URLS: Record<number, string> = {
  42161: 'https://api.cow.fi/arbitrum_one', // Arbitrum
  56: 'https://api.cow.fi/bnb', // BNB Chain
};

// CoW Protocol staging API URLs (for testing)
const COW_STAGING_API_URLS: Record<number, string> = {
  42161: 'https://barn.api.cow.fi/arbitrum_one',
  56: 'https://barn.api.cow.fi/bnb',
};

interface CowQuoteRequest {
  sellToken: string; // Token address
  buyToken: string; // Token address
  from: string; // User address
  kind: 'sell' | 'buy'; // Order type
  sellAmountBeforeFee?: string; // For sell orders - amount before fees
  sellAmountAfterFee?: string; // For sell orders - amount after fees
  buyAmountAfterFee?: string; // For buy orders - amount to receive
  priceQuality?: 'fast' | 'optimal' | 'verified'; // Default: verified
  signingScheme?: 'eip712' | 'ethsign' | 'eip1271'; // Default: eip712
  onchainOrder?: boolean; // Default: false
  validTo?: number; // Unix timestamp, default: 30 minutes from now
  appData?: string; // App metadata (optional)
  partiallyFillable?: boolean; // Default: false
}

interface CowQuoteResponse {
  quote: {
    sellToken: string;
    buyToken: string;
    receiver: string;
    sellAmount: string; // Amount in wei
    buyAmount: string; // Amount in wei
    validTo: number;
    appData: string;
    feeAmount: string; // Fee in sell token
    kind: 'sell' | 'buy';
    partiallyFillable: boolean;
    sellTokenBalance: 'erc20' | 'external' | 'internal';
    buyTokenBalance: 'erc20' | 'internal';
    signingScheme: string;
  };
  from: string;
  expiration: string; // ISO timestamp
  id: number; // Quote ID
}

interface CowOrderCreation {
  sellToken: string;
  buyToken: string;
  receiver: string;
  sellAmount: string;
  buyAmount: string;
  validTo: number;
  appData: string;
  feeAmount: string;
  kind: 'sell' | 'buy';
  partiallyFillable: boolean;
  sellTokenBalance: 'erc20' | 'external' | 'internal';
  buyTokenBalance: 'erc20' | 'internal';
  signature: string; // EIP-712 signature
  signingScheme: 'eip712' | 'ethsign' | 'eip1271';
  from: string;
}

interface CowOrderResponse {
  orderId: string; // Order UID
}

/**
 * Get the base API URL for a given chain
 */
function getApiUrl(chainId: number, useStaging: boolean = false): string {
  const urls = useStaging ? COW_STAGING_API_URLS : COW_API_URLS;
  const url = urls[chainId];

  if (!url) {
    throw new Error(`CoW Protocol not supported on chain ${chainId}. Supported: Arbitrum (42161), BNB Chain (56)`);
  }

  return url;
}

/**
 * Get USD price for a token using CoW Protocol price estimation
 * Uses USDC as the quote token for price calculation
 */
export async function getCowTokenPrice(
  tokenSymbol: string,
  chainId: number
): Promise<{ success: boolean; price?: string; error?: string; userMessage?: string }> {
  try {
    const token = getTokenBySymbol(tokenSymbol, chainId);
    const usdc = getTokenBySymbol('USDC', chainId);

    if (!token) {
      return {
        success: false,
        userMessage: `Token ${tokenSymbol} is not available on this chain. Try WETH, USDC, USDT, or other popular tokens.`,
        error: `Token not found: ${tokenSymbol}`
      };
    }

    if (!usdc) {
      return {
        success: false,
        userMessage: 'USDC not available on this chain for price calculation.',
        error: 'USDC not found'
      };
    }

    // Get quote for 1 token to USDC
    const oneToken = formatTokenAmount('1', token.decimals);
    const apiUrl = getApiUrl(chainId);

    const quoteRequest: CowQuoteRequest = {
      sellToken: token.address,
      buyToken: usdc.address,
      from: '0x0000000000000000000000000000000000000000', // Dummy address for price check
      kind: 'sell',
      sellAmountBeforeFee: oneToken.toString(),
      priceQuality: 'verified',
      signingScheme: 'eip712',
      onchainOrder: false,
      validTo: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
      partiallyFillable: false,
    };

    const response = await fetch(`${apiUrl}/api/v1/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(quoteRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        userMessage: `Unable to get price for ${tokenSymbol}. The token might not have enough liquidity on this chain.`,
        error: `API error: ${response.status} - ${errorText}`
      };
    }

    const quoteData: CowQuoteResponse = await response.json();

    // Calculate price: buyAmount / sellAmount (adjusted for decimals)
    const buyAmount = BigInt(quoteData.quote.buyAmount);
    const sellAmount = BigInt(quoteData.quote.sellAmount);

    // Price = (buyAmount / 10^usdcDecimals) / (sellAmount / 10^tokenDecimals)
    const price = Number(buyAmount) / Math.pow(10, usdc.decimals) / (Number(sellAmount) / Math.pow(10, token.decimals));

    return {
      success: true,
      price: price.toFixed(2)
    };
  } catch (error) {
    console.error('Error fetching CoW token price:', error);
    return {
      success: false,
      userMessage: 'Having trouble getting the price right now. Want to try again?',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get a quote for swapping tokens using CoW Protocol
 */
export async function getCowSwapQuote(
  fromTokenSymbol: string,
  toTokenSymbol: string,
  amount: string,
  userAddress: string | undefined,
  chainId: number,
  slippage: number = 0.005 // 0.5% default
): Promise<{
  success: boolean;
  outputAmount?: string;
  priceImpact?: string;
  gasEstimate?: string;
  route?: string;
  quoteId?: number;
  validTo?: number;
  feeAmount?: string;
  error?: string;
  userMessage?: string;
}> {
  try {
    const fromToken = getTokenBySymbol(fromTokenSymbol, chainId);
    const toToken = getTokenBySymbol(toTokenSymbol, chainId);

    if (!fromToken) {
      return {
        success: false,
        userMessage: `I couldn't find ${fromTokenSymbol} on this chain. Could you double-check the token name?`,
        error: `Token not found: ${fromTokenSymbol}`
      };
    }

    if (!toToken) {
      return {
        success: false,
        userMessage: `I couldn't find ${toTokenSymbol} on this chain. Could you double-check the token name?`,
        error: `Token not found: ${toTokenSymbol}`
      };
    }

    // Convert amount to wei
    const sellAmount = formatTokenAmount(amount, fromToken.decimals);
    const apiUrl = getApiUrl(chainId);

    // Use dummy address if user address not provided
    const from = userAddress || '0x0000000000000000000000000000000000000000';

    const quoteRequest: CowQuoteRequest = {
      sellToken: fromToken.address,
      buyToken: toToken.address,
      from,
      kind: 'sell',
      sellAmountBeforeFee: sellAmount.toString(),
      priceQuality: 'verified',
      signingScheme: 'eip712',
      onchainOrder: false,
      validTo: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
      partiallyFillable: false,
    };

    const response = await fetch(`${apiUrl}/api/v1/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(quoteRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        userMessage: `Unable to get a quote for this swap. The pair might not have enough liquidity.`,
        error: `API error: ${response.status} - ${errorText}`
      };
    }

    const quoteData: CowQuoteResponse = await response.json();

    // Format output amount
    const buyAmountBigInt = BigInt(quoteData.quote.buyAmount);
    const outputAmount = (Number(buyAmountBigInt) / Math.pow(10, toToken.decimals)).toFixed(6);

    // Format fee amount
    const feeAmountBigInt = BigInt(quoteData.quote.feeAmount);
    const feeAmount = (Number(feeAmountBigInt) / Math.pow(10, fromToken.decimals)).toFixed(6);

    // Calculate price impact (simplified - would need market price for accurate calculation)
    // For now, assume low price impact for CoW Protocol due to batch auction mechanism
    const priceImpact = '< 0.01';

    return {
      success: true,
      outputAmount,
      priceImpact,
      gasEstimate: '~Free (subsidized by protocol)', // CoW Protocol often subsidizes gas
      route: `${fromTokenSymbol} → [CoW Protocol Batch Auction] → ${toTokenSymbol}`,
      quoteId: quoteData.id,
      validTo: quoteData.quote.validTo,
      feeAmount: `${feeAmount} ${fromTokenSymbol}`,
    };
  } catch (error) {
    console.error('Error fetching CoW swap quote:', error);
    return {
      success: false,
      userMessage: 'Something went wrong while getting the quote. Want to try again?',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Create an order on CoW Protocol (requires signature from user)
 * Note: This returns the order data that needs to be signed by the user's wallet
 */
export async function createCowSwapOrder(
  fromTokenSymbol: string,
  toTokenSymbol: string,
  amount: string,
  userAddress: string,
  chainId: number,
  slippage: number = 0.005
): Promise<{
  success: boolean;
  orderUid?: string;
  orderData?: {
    sellToken: string;
    buyToken: string;
    receiver: string;
    sellAmount: string;
    buyAmount: string;
    validTo: number;
    appData: string;
    feeAmount: string;
    kind: 'sell' | 'buy';
    partiallyFillable: boolean;
    sellTokenBalance: 'erc20' | 'external' | 'internal';
    buyTokenBalance: 'erc20' | 'internal';
  };
  message?: string;
  error?: string;
  userMessage?: string;
}> {
  try {
    // First, get a fresh quote
    const quote = await getCowSwapQuote(
      fromTokenSymbol,
      toTokenSymbol,
      amount,
      userAddress,
      chainId,
      slippage
    );

    if (!quote.success) {
      return {
        success: false,
        userMessage: quote.userMessage,
        error: quote.error
      };
    }

    // Get fresh quote with actual order parameters
    const fromToken = getTokenBySymbol(fromTokenSymbol, chainId);
    const toToken = getTokenBySymbol(toTokenSymbol, chainId);

    if (!fromToken || !toToken) {
      return {
        success: false,
        userMessage: 'Token not found',
        error: 'Token lookup failed'
      };
    }

    // Get a fresh quote from CoW Protocol API to get exact order parameters
    const sellAmount = formatTokenAmount(amount, fromToken.decimals);
    const apiUrl = getApiUrl(chainId);

    // IMPORTANT: All addresses must be lowercase for CoW Protocol
    const quoteRequest: CowQuoteRequest = {
      sellToken: fromToken.address.toLowerCase(),
      buyToken: toToken.address.toLowerCase(),
      from: userAddress.toLowerCase(),
      kind: 'sell',
      sellAmountBeforeFee: sellAmount.toString(),
      priceQuality: 'verified',
      signingScheme: 'eip712',
      onchainOrder: false,
      validTo: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
      partiallyFillable: false,
    };

    const response = await fetch(`${apiUrl}/api/v1/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(quoteRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        userMessage: `Unable to create order. Please try again.`,
        error: `API error: ${response.status} - ${errorText}`
      };
    }

    const quoteData: CowQuoteResponse = await response.json();

    // Return the exact order data from the quote that needs to be signed
    // IMPORTANT: CoW Protocol API returns lowercase addresses already
    // IMPORTANT: receiver should be 0x0 when null (same as from address)
    // IMPORTANT: feeAmount must be "0" - the fee is already deducted from sellAmount by the API
    const orderData = {
      sellToken: quoteData.quote.sellToken,
      buyToken: quoteData.quote.buyToken,
      receiver: quoteData.quote.receiver || '0x0000000000000000000000000000000000000000',
      sellAmount: quoteData.quote.sellAmount,
      buyAmount: quoteData.quote.buyAmount,
      validTo: quoteData.quote.validTo,
      appData: quoteData.quote.appData,
      feeAmount: "0", // Fee must be zero - already deducted from sellAmount
      kind: quoteData.quote.kind,
      partiallyFillable: quoteData.quote.partiallyFillable,
      sellTokenBalance: quoteData.quote.sellTokenBalance,
      buyTokenBalance: quoteData.quote.buyTokenBalance,
    };

    // Calculate output amount for display
    const buyAmountFormatted = (Number(BigInt(quoteData.quote.buyAmount)) / Math.pow(10, toToken.decimals)).toFixed(6);

    return {
      success: true,
      orderData,
      message: `Order ready for signing. This will swap ${amount} ${fromTokenSymbol} for approximately ${buyAmountFormatted} ${toTokenSymbol}. The order will be submitted to CoW Protocol's batch auction and executed at the best available price.`
    };
  } catch (error) {
    console.error('Error creating CoW order:', error);
    return {
      success: false,
      userMessage: 'Something went wrong while creating the order. Want to try again?',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Submit a signed order to CoW Protocol
 * This would be called after the user signs the order data
 */
export async function submitCowSwapOrder(
  orderData: CowOrderCreation,
  chainId: number
): Promise<{
  success: boolean;
  orderId?: string;
  message?: string;
  error?: string;
}> {
  try {
    const apiUrl = getApiUrl(chainId);

    console.log('Submitting order to CoW Protocol:');
    console.log('API URL:', `${apiUrl}/api/v1/orders`);
    console.log('Order data:', JSON.stringify(orderData, null, 2));

    const response = await fetch(`${apiUrl}/api/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('CoW Protocol API error:', errorText);
      return {
        success: false,
        error: `Failed to submit order: ${response.status} - ${errorText}`
      };
    }

    const result: CowOrderResponse = await response.json();

    return {
      success: true,
      orderId: result.orderId,
      message: `Order submitted successfully! Order ID: ${result.orderId}. Your swap will be executed in the next batch auction.`
    };
  } catch (error) {
    console.error('Error submitting CoW order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
