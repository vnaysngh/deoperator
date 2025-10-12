import { getTokenBySymbol } from "./tokens";

const SUSHISWAP_API_BASE_URL = "https://api.sushi.com/quote/v7";
const SUSHISWAP_PRICE_API_URL = "https://api.sushi.com/price/v1";

// Chains verified to be supported by SushiSwap API v7
// Based on testing and SushiSwap documentation
export const SUSHISWAP_SUPPORTED_CHAINS = [
  1, // Ethereum
  42161, // Arbitrum
  137, // Polygon
  56 // BNB Chain
  // Note: Unichain (130) support pending - check https://docs.sushi.com for updates
] as const;

/**
 * Check if a chain is supported by SushiSwap API
 */
export function isSushiSwapChainSupported(chainId: number): boolean {
  return (SUSHISWAP_SUPPORTED_CHAINS as readonly number[]).includes(chainId);
}

export interface SushiSwapQuote {
  success: boolean;
  fromToken: string;
  toToken: string;
  inputAmount: string;
  outputAmount: string;
  priceImpact?: string;
  gasEstimate?: string;
  route?: string;
  routeProcessorAddress?: string;
  routeProcessorArgs?: Record<string, unknown>;
  error?: string;
}

export interface SushiSwapAPIResponse {
  status?: string;
  tokens?: Array<{
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  }>;
  tokenFrom?: number;
  tokenTo?: number;
  swapPrice?: number;
  priceImpact?: number;
  amountIn?: string;
  assumedAmountOut?: string;
  gasSpent?: number;
  error?: string;
}

/**
 * Get a swap quote from SushiSwap API
 * @param fromTokenSymbol - Token symbol to swap from (e.g., WETH, USDC)
 * @param toTokenSymbol - Token symbol to swap to (e.g., USDC, DAI)
 * @param amount - Amount of input token to swap (in human-readable format)
 * @param walletAddress - User's wallet address (optional, not used by quote endpoint)
 * @param chainId - Chain ID (default: 1 for Ethereum mainnet)
 * @param maxSlippage - Maximum slippage tolerance (default: 0.005 for 0.5%)
 * @returns Promise<SushiSwapQuote>
 */
export async function getSushiSwapQuote(
  fromTokenSymbol: string,
  toTokenSymbol: string,
  amount: string,
  walletAddress?: string,
  chainId: number = 1,
  maxSlippage: number = 0.005
): Promise<SushiSwapQuote> {
  try {
    // Validate chain support first
    if (!isSushiSwapChainSupported(chainId)) {
      return {
        success: false,
        fromToken: fromTokenSymbol,
        toToken: toTokenSymbol,
        inputAmount: amount,
        outputAmount: "0",
        error: `SushiSwap doesn't support chain ID ${chainId} yet. Supported chains: Ethereum (1), Arbitrum (42161), Polygon (137), BNB Chain (56). Please try one of these chains.`
      };
    }

    const fromToken = await getTokenBySymbol(fromTokenSymbol, chainId);
    const toToken = await getTokenBySymbol(toTokenSymbol, chainId);

    if (!fromToken || !toToken) {
      return {
        success: false,
        fromToken: fromTokenSymbol,
        toToken: toTokenSymbol,
        inputAmount: amount,
        outputAmount: "0",
        error: `Token "${
          !fromToken ? fromTokenSymbol : toTokenSymbol
        }" not found on chain ${chainId}. Try checking the token symbol or providing a contract address.`
      };
    }

    // Convert amount to wei/smallest unit
    const amountInWei = parseFloat(amount) * Math.pow(10, fromToken.decimals);
    const amountInWeiString = Math.floor(amountInWei).toString();

    // Build API URL with query parameters matching the sample
    const params = new URLSearchParams({
      tokenIn: fromToken.address,
      tokenOut: toToken.address,
      amount: amountInWeiString,
      fee: "0",
      feeBy: "output",
      maxSlippage: maxSlippage.toString(),
      vizualize: "false"
    });

    const url = `${SUSHISWAP_API_BASE_URL}/${chainId}?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(
        `SushiSwap API error: ${response.status} ${response.statusText}`
      );
    }

    const data: SushiSwapAPIResponse = await response.json();

    if (data.status !== "Success" || !data.assumedAmountOut) {
      return {
        success: false,
        fromToken: fromTokenSymbol,
        toToken: toTokenSymbol,
        inputAmount: amount,
        outputAmount: "0",
        error: data.error || "No route found for this swap"
      };
    }

    // Convert output amount from wei to human-readable format
    const outputAmount = (
      parseFloat(data.assumedAmountOut) / Math.pow(10, toToken.decimals)
    ).toFixed(toToken.decimals);

    // Format price impact as percentage
    const priceImpact = data.priceImpact
      ? `${(data.priceImpact * 100).toFixed(2)}%`
      : undefined;

    // Build route string from tokens array
    let route = `${fromTokenSymbol} → ${toTokenSymbol}`;
    if (data.tokens && data.tokens.length > 2) {
      route = data.tokens.map((t) => t.symbol).join(" → ");
    }

    return {
      success: true,
      fromToken: fromTokenSymbol,
      toToken: toTokenSymbol,
      inputAmount: amount,
      outputAmount,
      priceImpact,
      gasEstimate: data.gasSpent?.toString(),
      route
    };
  } catch (error) {
    console.error("Error fetching SushiSwap quote:", error);
    return {
      success: false,
      fromToken: fromTokenSymbol,
      toToken: toTokenSymbol,
      inputAmount: amount,
      outputAmount: "0",
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}

/**
 * Get USD price for a token using SushiSwap Price API
 * @param tokenSymbol - Token symbol (e.g., WETH, USDC)
 * @param chainId - Chain ID (default: 1 for Ethereum mainnet)
 * @returns Promise<string> - USD price as a string
 */
export async function getTokenUSDPrice(
  tokenSymbol: string,
  chainId: number = 1
): Promise<{
  success: boolean;
  price?: string;
  error?: string;
  userMessage?: string;
}> {
  try {
    // Validate chain support first
    if (!isSushiSwapChainSupported(chainId)) {
      return {
        success: false,
        error: `Chain not supported`,
        userMessage: `I can't get prices on this chain yet. Try Ethereum, Arbitrum, Polygon, or BNB Chain instead!`
      };
    }

    const token = await getTokenBySymbol(tokenSymbol, chainId);

    if (!token) {
      return {
        success: false,
        error: `Token not found`,
        userMessage: `I couldn't find ${tokenSymbol} on this chain. Could you double-check the token name? Popular tokens include WETH, USDC, USDT, WBTC, and DAI.`
      };
    }

    // Fetch price for specific token (address MUST be lowercase for SushiSwap API)
    const url = `${SUSHISWAP_PRICE_API_URL}/${chainId}/${token.address.toLowerCase()}`;
    console.log(url, "url");
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    console.log(response, "response");
    if (!response.ok) {
      // Provide user-friendly messages based on error type
      if (response.status === 404) {
        return {
          success: false,
          error: `Price not available`,
          userMessage: `I couldn't find price data for ${tokenSymbol} on this chain. It might not have enough liquidity yet. Want to try a different token?`
        };
      }

      return {
        success: false,
        error: `API error ${response.status}`,
        userMessage: `Having trouble getting the price right now. Let me try again in a moment, or we could check a different token?`
      };
    }

    const price = await response.json();

    // Price API returns a number directly
    if (typeof price === "number") {
      return {
        success: true,
        price: price.toFixed(2)
      };
    }

    return {
      success: false,
      error: "Invalid response format",
      userMessage:
        "Got an unexpected response from the price service. Want to try again?"
    };
  } catch (error) {
    console.error("Error fetching token USD price:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      userMessage:
        "Having trouble connecting to the price service. Let's try again in a moment!"
    };
  }
}

/**
 * Get current price of a token pair
 * @param fromTokenSymbol - Base token symbol
 * @param toTokenSymbol - Quote token symbol
 * @param walletAddress - User's wallet address (optional, not used by quote endpoint)
 * @param chainId - Chain ID (default: 1 for Ethereum mainnet)
 * @returns Promise<string> - Price as a string
 */
export async function getSushiSwapPrice(
  fromTokenSymbol: string,
  toTokenSymbol: string,
  walletAddress?: string,
  chainId: number = 1
): Promise<string> {
  // Use 1 unit to get the price
  const quote = await getSushiSwapQuote(
    fromTokenSymbol,
    toTokenSymbol,
    "1",
    walletAddress,
    chainId
  );

  if (quote.success) {
    return quote.outputAmount;
  }

  throw new Error(quote.error || "Failed to get price");
}
