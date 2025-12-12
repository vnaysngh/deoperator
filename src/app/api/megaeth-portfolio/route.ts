import { NextRequest, NextResponse } from "next/server";
import type {
  MegaETHTokensResponse,
  MegaETHPortfolioItem
} from "@/types/zapper";

export const dynamic = "force-dynamic";

/**
 * GET /api/megaeth-portfolio
 *
 * Fetches MegaETH testnet token balances for a wallet address
 *
 * Query Parameters:
 * - address: Wallet address (required)
 *
 * Returns:
 * - Token balances on MegaETH testnet
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        {
          success: false,
          error: "Wallet address is required",
          userMessage:
            "Please provide a wallet address to fetch MegaETH portfolio data."
        },
        { status: 400 }
      );
    }

    console.log("[MEGAETH API] Fetching portfolio for:", address);

    // Fetch token balances from MegaETH Blockscout API
    const url = `https://megaeth-testnet.blockscout.com/api/v2/addresses/${address}/tokens?type=ERC-20`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      console.error("[MEGAETH API] Failed to fetch:", response.status);
      return NextResponse.json(
        {
          success: false,
          error: `MegaETH API returned status ${response.status}`,
          userMessage:
            "Unable to fetch MegaETH portfolio data. Please try again."
        },
        { status: response.status }
      );
    }

    const data = (await response.json()) as MegaETHTokensResponse;

    if (!data || !data.items) {
      return NextResponse.json(
        {
          success: false,
          error: "No data returned from MegaETH API",
          userMessage:
            "Unable to fetch MegaETH portfolio data. Please try again."
        },
        { status: 500 }
      );
    }

    // Process token balances
    const tokens: MegaETHPortfolioItem[] = data.items.map((item) => {
      const decimals = parseInt(item.token.decimals);
      const balanceRaw = item.value;
      const balance = parseFloat(balanceRaw) / Math.pow(10, decimals);

      return {
        tokenAddress: item.token.address_hash,
        name: item.token.name,
        symbol: item.token.symbol,
        decimals,
        balance,
        balanceRaw,
        imgUrl: item.token.icon_url
      };
    });

    // Filter out tokens with zero or very small balances
    const filteredTokens = tokens.filter((token) => token.balance > 0.000001);

    console.log(
      "[MEGAETH API] Portfolio fetched successfully. Token count:",
      filteredTokens.length
    );

    return NextResponse.json({
      success: true,
      message: "MegaETH portfolio data fetched successfully",
      address,
      tokens: filteredTokens,
      totalTokens: filteredTokens.length
    });
  } catch (error) {
    console.error("[MEGAETH API] Error fetching portfolio:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        userMessage:
          "Failed to fetch MegaETH portfolio data. Please try again later."
      },
      { status: 500 }
    );
  }
}
