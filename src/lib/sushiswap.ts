import { getTokenBySymbol } from "./tokens";

const SUSHISWAP_API_BASE_URL = "https://api.sushi.com/quote/v7";
const MORALIS_PRICE_API_BASE_URL = "https://deep-index.moralis.io/api/v2.2/erc20";

const MORALIS_CHAIN_MAP: Record<number, string> = {
  56: "bsc",
  42161: "arbitrum"
};

// Only BNB Chain and Arbitrum are supported
export const SUSHISWAP_SUPPORTED_CHAINS = [
  56, // BNB Chain
  42161, // Arbitrum
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
 * @param chainId - Chain ID (default: 56 for BNB Chain)
 * @param maxSlippage - Maximum slippage tolerance (default: 0.005 for 0.5%)
 * @returns Promise<SushiSwapQuote>
 */
export async function getSushiSwapQuote(
  fromTokenSymbol: string,
  toTokenSymbol: string,
  amount: string,
  walletAddress?: string,
  chainId: number = 56,
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
        error: `SushiSwap doesn't support chain ID ${chainId}. Supported chains: BNB Chain (56), Arbitrum (42161). Please try one of these chains.`
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
 * Get USD price for a token using Moralis Price API
 * @param tokenSymbol - Token symbol (e.g., WETH, USDC)
 * @param chainId - Chain ID (default: 56 for BNB Chain)
 * @returns Promise<string> - USD price as a string
 */
export async function getTokenUSDPrice(
  tokenSymbol: string,
  chainId: number = 56
): Promise<{
  success: boolean;
  price?: string;
  priceNumber?: number;
  symbol?: string;
  tokenAddress?: string;
  error?: string;
  userMessage?: string;
}> {
  try {
    const moralisChain = MORALIS_CHAIN_MAP[chainId];

    if (!moralisChain) {
      return {
        success: false,
        error: "Chain not supported",
        userMessage:
          "I can only fetch prices on Arbitrum or BNB Chain right now. Want to try one of those networks?"
      };
    }

    const apiKey = process.env.MORALIS_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: "MORALIS_API_KEY is missing",
        userMessage:
          "Price lookups are unavailable at the moment. Please try again in a bit!"
      };
    }

    const normalizedInput = tokenSymbol.trim();
    const lowerInput = normalizedInput.toLowerCase();
    const looksLikeAddress =
      lowerInput.startsWith("0x") && lowerInput.length === 42;

    let tokenAddress = lowerInput;
    let resolvedSymbol = normalizedInput.toUpperCase();

    if (!looksLikeAddress) {
      const token = await getTokenBySymbol(normalizedInput, chainId);

      if (!token) {
        return {
          success: false,
          error: "Token not found",
          userMessage: `I couldn't find ${normalizedInput} on this chain. Could you double-check the token symbol or share the contract address?`
        };
      }

      tokenAddress = token.address.toLowerCase();
      resolvedSymbol = token.symbol ?? resolvedSymbol;
    }

    const url = `${MORALIS_PRICE_API_BASE_URL}/${tokenAddress}/price?chain=${moralisChain}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-Key": apiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Moralis price API error ${response.status}: ${errorText}`,
        userMessage:
          "Having trouble getting the price right now. Want to try another token or check again in a minute?"
      };
    }

    interface MoralisPriceResponse {
      tokenSymbol?: string;
      tokenAddress?: string;
      usdPrice?: number;
      usdPriceFormatted?: string;
    }

    const data: MoralisPriceResponse = await response.json();
    const usdPrice =
      typeof data.usdPrice === "number"
        ? data.usdPrice
        : typeof data.usdPriceFormatted === "string"
        ? parseFloat(data.usdPriceFormatted.replace(/[^0-9.-]/g, ""))
        : undefined;

    if (usdPrice === undefined || Number.isNaN(usdPrice)) {
      return {
        success: false,
        error: "Invalid response format",
        userMessage:
          "Got an unexpected response from the price service. Should we try again?"
      };
    }

    const formattedPrice =
      usdPrice >= 1
        ? usdPrice.toFixed(2)
        : usdPrice >= 0.01
        ? usdPrice.toFixed(4)
        : usdPrice.toPrecision(3);

    if (looksLikeAddress && data.tokenSymbol) {
      resolvedSymbol = data.tokenSymbol;
    }

    return {
      success: true,
      price: formattedPrice,
      priceNumber: usdPrice,
      symbol: resolvedSymbol,
      tokenAddress: data.tokenAddress?.toLowerCase() ?? tokenAddress
    };
  } catch (error) {
    console.error("Error fetching token USD price:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      userMessage:
        "Having trouble connecting to the price service. Let's try again shortly!"
    };
  }
}

/**
 * Get current price of a token pair
 * @param fromTokenSymbol - Base token symbol
 * @param toTokenSymbol - Quote token symbol
 * @param walletAddress - User's wallet address (optional, not used by quote endpoint)
 * @param chainId - Chain ID (default: 56 for BNB Chain)
 * @returns Promise<string> - Price as a string
 */
export async function getSushiSwapPrice(
  fromTokenSymbol: string,
  toTokenSymbol: string,
  walletAddress?: string,
  chainId: number = 56
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

export interface SushiSwapTransaction {
  success: boolean;
  tx?: {
    from: string;
    to: string;
    data: string;
    value: string;
  };
  route?: string;
  priceImpact?: string;
  gasEstimate?: string;
  inputAmount?: string;
  outputAmount?: string;
  fromToken?: string;
  toToken?: string;
  error?: string;
  userMessage?: string;
}

/**
 * Get transaction data for executing a swap on SushiSwap
 * Uses the /swap/v7 endpoint which returns executable transaction data
 * @param fromTokenSymbol - Token symbol to swap from
 * @param toTokenSymbol - Token symbol to swap to
 * @param amount - Amount of input token to swap (in human-readable format)
 * @param walletAddress - User's wallet address (REQUIRED for swap endpoint)
 * @param chainId - Chain ID
 * @param maxSlippage - Maximum slippage tolerance (default: 0.005 for 0.5%)
 * @returns Promise<SushiSwapTransaction>
 */
export async function getSushiSwapTransaction(
  fromTokenSymbol: string,
  toTokenSymbol: string,
  amount: string,
  walletAddress: string,
  chainId: number = 56,
  maxSlippage: number = 0.005
): Promise<SushiSwapTransaction> {
  try {
    // Validate chain support first
    if (!isSushiSwapChainSupported(chainId)) {
      return {
        success: false,
        error: `Chain not supported`,
        userMessage: `SushiSwap doesn't support chain ID ${chainId}. Supported chains: BNB Chain (56), Arbitrum (42161).`,
      };
    }

    const fromToken = await getTokenBySymbol(fromTokenSymbol, chainId);
    const toToken = await getTokenBySymbol(toTokenSymbol, chainId);

    if (!fromToken || !toToken) {
      return {
        success: false,
        error: `Token not found`,
        userMessage: `I couldn't find ${!fromToken ? fromTokenSymbol : toTokenSymbol} on this chain. Could you double-check the token name?`,
      };
    }

    // Convert amount to wei/smallest unit
    const amountInWei = parseFloat(amount) * Math.pow(10, fromToken.decimals);
    const amountInWeiString = Math.floor(amountInWei).toString();

    // Build API URL for SWAP endpoint (note: /swap not /quote)
    const SWAP_API_URL = "https://api.sushi.com/swap/v7";
    const params = new URLSearchParams({
      tokenIn: fromToken.address.toLowerCase(),
      tokenOut: toToken.address.toLowerCase(),
      amount: amountInWeiString,
      maxSlippage: maxSlippage.toString(),
      sender: walletAddress, // Required for swap endpoint
    });

    const url = `${SWAP_API_URL}/${chainId}?${params.toString()}`;
    console.log('Fetching swap transaction:', url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `API error ${response.status}`,
        userMessage: `Having trouble getting swap data right now. The API returned status ${response.status}. Want to try again?`,
      };
    }

    const data = await response.json();

    // Check if swap route was found
    if (data.status !== "Success" || !data.tx) {
      return {
        success: false,
        error: data.error || "No route found",
        userMessage: `I couldn't find a swap route for ${fromTokenSymbol} to ${toTokenSymbol} on this chain. The tokens might not have enough liquidity.`,
      };
    }

    // Convert output amount from wei to human-readable format
    const outputAmount = data.assumedAmountOut
      ? (parseFloat(data.assumedAmountOut) / Math.pow(10, toToken.decimals)).toFixed(toToken.decimals)
      : undefined;

    // Format price impact as percentage
    const priceImpact = data.priceImpact
      ? `${(data.priceImpact * 100).toFixed(2)}%`
      : undefined;

    // Build route string from tokens array
    let route = `${fromTokenSymbol} → ${toTokenSymbol}`;
    if (data.tokens && data.tokens.length > 2) {
      route = data.tokens.map((t: { symbol: string }) => t.symbol).join(" → ");
    }

    return {
      success: true,
      tx: {
        from: data.tx.from,
        to: data.tx.to,
        data: data.tx.data,
        value: data.tx.value || "0",
      },
      route,
      priceImpact,
      gasEstimate: data.gasSpent?.toString(),
      inputAmount: amount,
      outputAmount,
      fromToken: fromTokenSymbol,
      toToken: toTokenSymbol,
    };
  } catch (error) {
    console.error("Error fetching SushiSwap transaction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      userMessage: "Having trouble connecting to SushiSwap. Let's try again in a moment!",
    };
  }
}
