import { NextRequest, NextResponse } from "next/server";
import {
  fetchCreatorCoinsPage,
  filterByMarketCap,
  filterByVolume,
  determineCoinStatus,
  getCoinTradingUrl,
  getCoinExplorerUrl,
  getZoraCoinUrl,
  getZoraCreatorUrl,
  calculate24hChange,
  type ZoraCoin,
  type ZoraQueryType
} from "@/lib/zora-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Transform Zora coin data to frontend format
 */
function transformCoinData(coin: ZoraCoin) {
  const status = determineCoinStatus(coin);
  const priceChange24h = calculate24hChange(coin);

  // Extract image URL from mediaContent or fallback
  const imageUrl =
    coin.mediaContent?.previewImage?.medium ||
    coin.mediaContent?.previewImage?.small ||
    coin.imageUrl;

  // Extract creator handle
  const creatorHandle = coin.creatorProfile?.handle;

  return {
    id: coin.id,
    address: coin.address,
    symbol: coin.symbol,
    name: coin.name,
    description: coin.description || "",
    imageUrl,

    // Market data - Convert strings to numbers
    marketCap: Number(coin.marketCap || 0),
    volume24h: Number(coin.volume24h || 0),
    priceChange24h: Number(priceChange24h || 0),

    // Pool/Trading data
    uniqueHolders: coin.uniqueHolders || 0,
    totalSupply: coin.totalSupply,

    // Metadata
    createdAt: coin.createdAt || new Date().toISOString(),
    creatorAddress: coin.creatorAddress,
    creatorHandle,
    status,

    // URLs
    zoraCoinUrl: getZoraCoinUrl(coin.address),
    zoraCreatorUrl: creatorHandle
      ? getZoraCreatorUrl(creatorHandle)
      : undefined,
    tradingUrl: getCoinTradingUrl(coin.address),
    explorerUrl: getCoinExplorerUrl(coin.address)
  };
}

/**
 * GET /api/zora/creator-coins
 *
 * Fetch Zora creator coins using the official Zora SDK
 *
 * Query params:
 * - type: 'new' | 'trending' | 'top_volume' | 'most_valuable' | 'top_gainers' (default: 'trending')
 * - minMarketCap: Minimum market cap in USD
 * - minVolume: Minimum 24h volume in USD
 * - limit: Number of coins to return (default: 10, max: 20)
 * - cursor: Pagination cursor for next page
 * - new24h: 'true' to only show coins launched in last 24h
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const queryType = (searchParams.get("type") || "trending") as ZoraQueryType;
    const minMarketCap = searchParams.get("minMarketCap")
      ? Number(searchParams.get("minMarketCap"))
      : undefined;
    const minVolume = searchParams.get("minVolume")
      ? Number(searchParams.get("minVolume"))
      : undefined;
    const limit = Math.min(
      Number(searchParams.get("limit") || 10),
      20 // Max 20 per page
    );
    const cursor = searchParams.get("cursor") || undefined;
    const new24h = searchParams.get("new24h") === "true";

    console.log("[API] Fetching Zora creator coins:", {
      queryType,
      minMarketCap,
      minVolume,
      limit,
      cursor,
      new24h
    });

    // Fetch coins from Zora SDK with pagination
    const result = await fetchCreatorCoinsPage(queryType, {
      count: limit,
      after: cursor
    });
    let coins = result.coins;

    // Apply filters
    if (minMarketCap !== undefined) {
      coins = filterByMarketCap(coins, minMarketCap);
    }

    if (minVolume !== undefined) {
      coins = filterByVolume(coins, minVolume);
    }

    // Filter for new coins (last 24h) if requested
    if (new24h) {
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      coins = coins.filter((coin) => {
        if (!coin.createdAt) return false;
        const createdTime = new Date(coin.createdAt).getTime();
        return createdTime >= twentyFourHoursAgo;
      });
    }

    // Transform to frontend format
    const transformedCoins = coins.map(transformCoinData);

    console.log(`[API] Returning ${transformedCoins.length} creator coins`);

    return NextResponse.json(
      {
        coins: transformedCoins,
        count: transformedCoins.length,
        pagination: {
          hasNextPage: result.pageInfo.hasNextPage,
          nextCursor: result.pageInfo.endCursor
        },
        filters: {
          queryType,
          minMarketCap,
          minVolume,
          new24h
        }
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
        }
      }
    );
  } catch (error) {
    console.error("[API] Error fetching creator coins:", error);

    // Check if it's a rate limit error
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const isRateLimitError = errorMessage.toLowerCase().includes("rate limit");

    return NextResponse.json(
      {
        error: "Failed to fetch creator coins",
        message: errorMessage,
        hint: isRateLimitError
          ? "Rate limit reached. Please add ZORA_API_KEY to your .env.local file. Get your key at https://zora.co (Developer Settings)"
          : "Check logs for details"
      },
      { status: isRateLimitError ? 429 : 500 }
    );
  }
}
