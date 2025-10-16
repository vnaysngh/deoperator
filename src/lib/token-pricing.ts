import { getTokenBySymbol } from "./tokens";

const MORALIS_PRICE_API_BASE_URL = "https://deep-index.moralis.io/api/v2.2/erc20";

const MORALIS_CHAIN_MAP: Record<number, string> = {
  56: "bsc",
  42161: "arbitrum"
};

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
