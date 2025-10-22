/**
 * Zora Coins SDK Client
 *
 * Wrapper for @zoralabs/coins-sdk with API key support
 */

import {
  getCoinsNew,
  getCoinsTopVolume24h,
  getCoinsTopGainers,
  getCoinsMostValuable,
  setApiKey
} from "@zoralabs/coins-sdk";

// Define our own type for query options
export type ExploreQueryOptions = {
  after?: string;
  count?: number;
};

// Types based on Zora SDK documentation
export type ZoraCoin = {
  id: string;
  name: string;
  description?: string;
  address: string;
  symbol: string;
  totalSupply?: string;
  volume24h?: string | number;
  marketCap?: string | number;
  marketCapDelta24h?: string | number;
  creatorAddress?: string;
  uniqueHolders?: number;
  createdAt?: string;
  imageUrl?: string;
  mediaContent?: {
    previewImage?: {
      small?: string;
      medium?: string;
    };
  };
  creatorProfile?: {
    handle?: string;
    avatar?: {
      previewImage?: {
        small?: string;
        medium?: string;
      };
    };
  };
  [key: string]: unknown; // Allow additional properties from SDK
};

export type ExploreResponse = {
  data?: {
    exploreList: {
      edges: Array<{
        node: ZoraCoin;
      }>;
      pageInfo: {
        endCursor?: string;
        hasNextPage?: boolean;
      };
    };
  };
};

export type ZoraQueryType =
  | "new"
  | "trending"
  | "top_volume"
  | "most_valuable"
  | "top_gainers";

export type PaginatedCoinsResult = {
  coins: ZoraCoin[];
  pageInfo: {
    endCursor?: string;
    hasNextPage: boolean;
  };
};

/**
 * Initialize Zora SDK with API key from environment
 */
export function initializeZoraClient(): void {
  const apiKey = process.env.ZORA_API_KEY;

  if (apiKey) {
    setApiKey(apiKey);
    console.log("[Zora] API key configured");
  } else {
    console.warn("[Zora] No API key found - using rate-limited public access");
  }
}

/**
 * Fetch single page of creator coins based on query type
 * Returns both coins and pagination info
 */
export async function fetchCreatorCoinsPage(
  queryType: ZoraQueryType = "top_volume",
  options: ExploreQueryOptions = {}
): Promise<PaginatedCoinsResult> {
  try {
    initializeZoraClient();

    const defaultOptions: ExploreQueryOptions = {
      count: options.count || 50,
      after: options.after
    };

    let response: ExploreResponse;

    switch (queryType) {
      case "new":
        response = await getCoinsNew(defaultOptions);
        break;

      case "trending":
      case "top_volume":
        response = await getCoinsTopVolume24h(defaultOptions);
        break;

      case "top_gainers":
        response = await getCoinsTopGainers(defaultOptions);
        break;

      case "most_valuable":
        response = await getCoinsMostValuable(defaultOptions);
        break;

      default:
        response = await getCoinsTopVolume24h(defaultOptions);
    }

    // Check if response is valid (note: response has data wrapper)
    if (
      !response ||
      !response.data ||
      !response.data.exploreList ||
      !response.data.exploreList.edges
    ) {
      console.error("[Zora] Invalid response structure:", response);
      throw new Error(
        "Invalid response from Zora API - API key may be required or rate limit reached"
      );
    }

    const coins = response.data.exploreList.edges.map((edge) => edge.node);
    const pageInfo = response.data.exploreList.pageInfo;

    console.log(
      `[Zora] Fetched ${coins.length} coins (type: ${queryType}, hasNextPage: ${pageInfo.hasNextPage})`
    );

    return {
      coins,
      pageInfo: {
        endCursor: pageInfo.endCursor,
        hasNextPage: pageInfo.hasNextPage || false
      }
    };
  } catch (error) {
    console.error("[Zora] Failed to fetch creator coins:", error);
    throw new Error(
      `Failed to fetch creator coins: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Fetch creator coins with pagination support
 * Fetches multiple pages until desired count is reached
 */
export async function fetchCreatorCoins(
  queryType: ZoraQueryType = "top_volume",
  options: { count?: number; maxPages?: number } = {}
): Promise<ZoraCoin[]> {
  const targetCount = options.count || 100;
  const maxPages = options.maxPages || 5; // Safety limit
  const perPage = 50; // Zora SDK seems to return ~20 per request, but we'll ask for 50

  let allCoins: ZoraCoin[] = [];
  let hasNextPage = true;
  let cursor: string | undefined = undefined;
  let pagesFetched = 0;

  console.log(
    `[Zora] Starting paginated fetch: target=${targetCount}, maxPages=${maxPages}`
  );

  while (
    hasNextPage &&
    allCoins.length < targetCount &&
    pagesFetched < maxPages
  ) {
    const result = await fetchCreatorCoinsPage(queryType, {
      count: perPage,
      after: cursor
    });

    allCoins = [...allCoins, ...result.coins];
    hasNextPage = result.pageInfo.hasNextPage;
    cursor = result.pageInfo.endCursor;
    pagesFetched++;

    console.log(
      `[Zora] Page ${pagesFetched}: fetched ${result.coins.length} coins, total: ${allCoins.length}, hasNext: ${hasNextPage}`
    );

    // If we got no coins, break to avoid infinite loop
    if (result.coins.length === 0) {
      console.log("[Zora] No more coins returned, stopping pagination");
      break;
    }
  }

  console.log(
    `[Zora] Pagination complete: fetched ${allCoins.length} coins across ${pagesFetched} pages`
  );

  // Return only the requested count
  return allCoins.slice(0, targetCount);
}

/**
 * Fetch new creator coins (launched in last 24h)
 */
export async function fetchNewCreatorCoins(
  count: number = 20
): Promise<ZoraCoin[]> {
  return fetchCreatorCoins("new", { count });
}

/**
 * Fetch trending creator coins (by volume)
 */
export async function fetchTrendingCreatorCoins(
  count: number = 20
): Promise<ZoraCoin[]> {
  return fetchCreatorCoins("top_volume", { count });
}

/**
 * Fetch top gainers (by market cap change)
 */
export async function fetchTopGainers(count: number = 20): Promise<ZoraCoin[]> {
  return fetchCreatorCoins("top_gainers", { count });
}

/**
 * Filter coins by minimum market cap
 */
export function filterByMarketCap(
  coins: ZoraCoin[],
  minMarketCap: number
): ZoraCoin[] {
  return coins.filter((coin) => Number(coin.marketCap || 0) >= minMarketCap);
}

/**
 * Filter coins by minimum 24h volume
 */
export function filterByVolume(
  coins: ZoraCoin[],
  minVolume: number
): ZoraCoin[] {
  return coins.filter((coin) => Number(coin.volume24h || 0) >= minVolume);
}

/**
 * Get Zora coin page URL
 */
export function getZoraCoinUrl(coinAddress: string): string {
  return `https://zora.co/coin/base:${coinAddress}`;
}

/**
 * Get Zora creator profile URL
 */
export function getZoraCreatorUrl(creatorHandle: string): string {
  // Handle can be with or without @ prefix
  const handle = creatorHandle.startsWith("@")
    ? creatorHandle
    : `@${creatorHandle}`;
  return `https://zora.co/${handle}`;
}

/**
 * Get Uniswap trading URL
 *
 * Creator coins can be traded on Uniswap V3/V4 on Base
 */
export function getCoinTradingUrl(coinAddress: string): string {
  // Use Uniswap interface for reliable trading on Base (chain ID 8453)
  return `https://app.uniswap.org/explore/tokens/base/${coinAddress}`;
}

/**
 * Get coin explorer URL (BaseScan)
 */
export function getCoinExplorerUrl(coinAddress: string): string {
  return `https://basescan.org/address/${coinAddress}`;
}

/**
 * Determine coin status based on age and metrics
 */
export function determineCoinStatus(
  coin: ZoraCoin
): "new" | "trending" | "low_liquidity" | "normal" {
  const now = Date.now();
  const createdAt = coin.createdAt ? new Date(coin.createdAt).getTime() : 0;
  const ageHours = (now - createdAt) / (1000 * 60 * 60);

  // New: launched in last 24h
  if (coin.createdAt && ageHours <= 24) {
    return "new";
  }

  // Trending: high volume in last 24h (> $10k)
  if (Number(coin.volume24h || 0) > 10000) {
    return "trending";
  }

  // Low liquidity: market cap < $10k
  if (Number(coin.marketCap || 0) < 10000) {
    return "low_liquidity";
  }

  return "normal";
}

/**
 * Format market cap for display
 */
export function formatMarketCap(marketCap: number | undefined): string {
  if (!marketCap || marketCap === 0) return "$0";

  if (marketCap >= 1_000_000_000) {
    return `$${(marketCap / 1_000_000_000).toFixed(2)}B`;
  }
  if (marketCap >= 1_000_000) {
    return `$${(marketCap / 1_000_000).toFixed(2)}M`;
  }
  if (marketCap >= 1_000) {
    return `$${(marketCap / 1_000).toFixed(1)}K`;
  }
  return `$${marketCap.toFixed(2)}`;
}

/**
 * Calculate 24h price change percentage
 */
export function calculate24hChange(coin: ZoraCoin): number {
  const marketCapDelta = Number(coin.marketCapDelta24h || 0);
  const marketCap = Number(coin.marketCap || 0);

  if (!marketCapDelta || !marketCap) return 0;

  const previousMarketCap = marketCap - marketCapDelta;
  if (previousMarketCap === 0) return 0;

  return (marketCapDelta / previousMarketCap) * 100;
}
