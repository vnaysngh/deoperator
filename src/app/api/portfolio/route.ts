import { NextRequest, NextResponse } from "next/server";
import { fetchPortfolioV2 } from "@/lib/zapper-client";
import type {
  PortfolioV2Response,
  NetworkSummary,
  PortfolioSummary
} from "@/types/zapper";

export const dynamic = "force-dynamic";

/**
 * GET /api/portfolio
 *
 * Fetches portfolio data for a wallet address using Zapper API
 *
 * Query Parameters:
 * - address: Wallet address (required)
 * - chainIds: Comma-separated list of chain IDs to filter (optional)
 *
 * Returns:
 * - Portfolio summary with token balances, app positions, and network breakdown
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const address = searchParams.get("address");
    const chainIdsParam = searchParams.get("chainIds");

    if (!address) {
      return NextResponse.json(
        {
          success: false,
          error: "Wallet address is required",
          userMessage:
            "Please provide a wallet address to fetch portfolio data."
        },
        { status: 400 }
      );
    }

    // Parse chain IDs if provided
    const chainIds = chainIdsParam
      ? chainIdsParam.split(",").map((id) => parseInt(id.trim()))
      : undefined;

    console.log(
      "[ZAPPER API] Fetching portfolio for:",
      address,
      "chainIds:",
      chainIds
    );

    // Fetch portfolio data from Zapper
    const data = (await fetchPortfolioV2(
      [address],
      chainIds
    )) as PortfolioV2Response;

    if (!data || !data.portfolioV2) {
      return NextResponse.json(
        {
          success: false,
          error: "No portfolio data returned from Zapper API",
          userMessage: "Unable to fetch portfolio data. Please try again."
        },
        { status: 500 }
      );
    }

    const portfolio = data.portfolioV2;

    console.log(portfolio, "portfoliooo");

    // Process token balances by network
    const tokensByNetwork = new Map<
      number,
      { balanceUSD: number; count: number }
    >();
    portfolio.tokenBalances.byToken.edges.forEach(({ node }) => {
      const existing = tokensByNetwork.get(node.networkId) || {
        balanceUSD: 0,
        count: 0
      };
      tokensByNetwork.set(node.networkId, {
        balanceUSD: existing.balanceUSD + node.balanceUSD,
        count: existing.count + 1
      });
    });

    // Process app balances by network
    const appsByNetwork = new Map<
      number,
      { balanceUSD: number; count: number }
    >();
    portfolio.appBalances.byApp.edges.forEach(({ node }) => {
      const existing = appsByNetwork.get(node.networkId) || {
        balanceUSD: 0,
        count: 0
      };
      appsByNetwork.set(node.networkId, {
        balanceUSD: existing.balanceUSD + node.balanceUSD,
        count: existing.count + 1
      });
    });

    // Create network summaries
    const networkMap = new Map<number, NetworkSummary>();

    // Add networks from token balances
    portfolio.tokenBalances.byNetwork.edges.forEach(({ node }) => {
      const tokenData = tokensByNetwork.get(node.networkId) || {
        balanceUSD: 0,
        count: 0
      };
      const appData = appsByNetwork.get(node.networkId) || {
        balanceUSD: 0,
        count: 0
      };

      networkMap.set(node.networkId, {
        chainId: node.network.chainId,
        name: node.network.name,
        slug: node.network.slug,
        tokenBalanceUSD: tokenData.balanceUSD,
        appBalanceUSD: appData.balanceUSD,
        totalBalanceUSD: tokenData.balanceUSD + appData.balanceUSD,
        tokenCount: tokenData.count,
        appCount: appData.count
      });
    });

    // Add networks from app balances that might not have tokens
    portfolio.appBalances.byNetwork.edges.forEach(({ node }) => {
      if (!networkMap.has(node.networkId)) {
        const appData = appsByNetwork.get(node.networkId) || {
          balanceUSD: 0,
          count: 0
        };
        networkMap.set(node.networkId, {
          chainId: node.network.chainId,
          name: node.network.name,
          slug: node.network.slug,
          tokenBalanceUSD: 0,
          appBalanceUSD: appData.balanceUSD,
          totalBalanceUSD: appData.balanceUSD,
          tokenCount: 0,
          appCount: appData.count
        });
      }
    });

    const networkSummaries = Array.from(networkMap.values()).sort(
      (a, b) => b.totalBalanceUSD - a.totalBalanceUSD
    );

    // Get top tokens (sorted by USD value)
    const topTokens = portfolio.tokenBalances.byToken.edges
      .map(({ node }) => node)
      .sort((a, b) => b.balanceUSD - a.balanceUSD)
      .slice(0, 20);

    // Get top apps (sorted by USD value)
    const topApps = portfolio.appBalances.byApp.edges
      .map(({ node }) => node)
      .sort((a, b) => b.balanceUSD - a.balanceUSD)
      .slice(0, 20);

    const summary: PortfolioSummary = {
      totalBalanceUSD:
        portfolio.tokenBalances.totalBalanceUSD +
        portfolio.appBalances.totalBalanceUSD,
      tokenBalanceUSD: portfolio.tokenBalances.totalBalanceUSD,
      appBalanceUSD: portfolio.appBalances.totalBalanceUSD,
      networkSummaries,
      topTokens,
      topApps
    };

    console.log(
      "[ZAPPER API] Portfolio fetched successfully. Total value:",
      summary.totalBalanceUSD
    );

    return NextResponse.json({
      success: true,
      message: "Portfolio data fetched successfully",
      address,
      summary,
      rawData: portfolio
    });
  } catch (error) {
    console.error("[ZAPPER API] Error fetching portfolio:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        userMessage:
          "Failed to fetch portfolio data. Please check your API key and try again."
      },
      { status: 500 }
    );
  }
}
