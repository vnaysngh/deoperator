import { CHAIN_IDS } from "./chains";

const COINGECKO_API_BASE_URL = "https://api.coingecko.com/api/v3";

const PLATFORM_ID_BY_CHAIN: Record<number, string> = {
  [CHAIN_IDS.ARBITRUM]: "arbitrum-one"
  // [CHAIN_IDS.BNB]: "binance-smart-chain"
};

const PLATFORM_ID_TO_CHAIN: Record<string, number> = Object.fromEntries(
  Object.entries(PLATFORM_ID_BY_CHAIN).map(([chain, platform]) => [
    platform,
    Number(chain)
  ])
);

interface CoinGeckoSearchCoin {
  id: string;
  name: string;
  api_symbol?: string;
  symbol: string;
  market_cap_rank: number | null;
  thumb?: string;
  large?: string;
}

interface CoinGeckoSearchResponse {
  coins: CoinGeckoSearchCoin[];
}

interface CoinGeckoPlatformDetail {
  contract_address: string;
  decimal_place: number | null;
  geckoterminal_url?: string | null;
}

export interface CoinGeckoCoinDetails {
  id: string;
  symbol: string;
  name: string;
  detail_platforms?: Record<string, CoinGeckoPlatformDetail>;
  platforms?: Record<string, string | null>;
  description?: Record<string, string>;
  image?: {
    thumb?: string;
    small?: string;
    large?: string;
  };
  market_cap_rank?: number | null;
  market_data?: {
    current_price?: Record<string, number>;
    market_cap?: Record<string, number>;
    total_volume?: Record<string, number>;
    price_change_percentage_24h?: number | null;
  };
  links?: {
    homepage?: string[];
    chat_url?: string[];
    announcement_url?: string[];
    twitter_screen_name?: string | null;
  };
}

function getApiKey(): string | undefined {
  return (
    process.env.COINGECKO_DEMO_API_KEY ||
    process.env.COINGECKO_API_KEY ||
    process.env.NEXT_PUBLIC_COINGECKO_API_KEY
  );
}

async function fetchFromCoingecko(
  path: string,
  query?: Record<string, string>
): Promise<Response> {
  const url = new URL(`${COINGECKO_API_BASE_URL}/${path.replace(/^\//, "")}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json"
  };

  const apiKey = getApiKey();
  if (apiKey) {
    headers["x-cg-demo-api-key"] = apiKey;
  }

  return fetch(url.toString(), {
    method: "GET",
    headers
  });
}

export async function searchCoin(query: string): Promise<CoinGeckoSearchCoin[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    console.warn("[COINGECKO] searchCoin called with empty query");
    return [];
  }

  try {
    console.log("[COINGECKO] Searching coins", { query: trimmed });
    const response = await fetchFromCoingecko("search", { query: trimmed });

    if (!response.ok) {
      console.error(
        "[COINGECKO] Search request failed:",
        response.status,
        response.statusText
      );
      return [];
    }

    const data = (await response.json()) as CoinGeckoSearchResponse;
    console.log("[COINGECKO] Search results received", {
      query: trimmed,
      matchCount: data.coins?.length ?? 0,
      symbols: data.coins?.map((coin) => coin.symbol).slice(0, 5)
    });
    return data.coins || [];
  } catch (error) {
    console.error("[COINGECKO] Search request error:", error);
    return [];
  }
}

export async function getCoinDetails(
  coinId: string
): Promise<CoinGeckoCoinDetails | null> {
  if (!coinId) {
    console.warn("[COINGECKO] getCoinDetails called without coinId");
    return null;
  }

  try {
    console.log("[COINGECKO] Fetching coin details", { coinId });
    const response = await fetchFromCoingecko(`coins/${coinId}`);

    if (!response.ok) {
      console.error(
        "[COINGECKO] Coin details request failed:",
        response.status,
        response.statusText
      );
      return null;
    }

    const data = (await response.json()) as CoinGeckoCoinDetails;
    console.log("[COINGECKO] Coin details received", {
      coinId,
      symbol: data.symbol,
      name: data.name,
      platformCount: Object.keys(data.detail_platforms || {}).length
    });
    return data;
  } catch (error) {
    console.error("[COINGECKO] Coin details request error:", error);
    return null;
  }
}

function pickBestMatch(
  coins: CoinGeckoSearchCoin[],
  symbol: string
): CoinGeckoSearchCoin | undefined {
  const upperSymbol = symbol.toUpperCase();
  const exactMatches = coins.filter(
    (coin) => coin.symbol.toUpperCase() === upperSymbol
  );

  if (exactMatches.length === 0) {
    return undefined;
  }

  const rankedMatches = exactMatches.sort((a, b) => {
    if (a.market_cap_rank === null && b.market_cap_rank === null) return 0;
    if (a.market_cap_rank === null) return 1;
    if (b.market_cap_rank === null) return -1;
    return a.market_cap_rank - b.market_cap_rank;
  });

  return rankedMatches[0];
}

export async function getCoinDetailsBySymbol(
  symbol: string
): Promise<CoinGeckoCoinDetails | null> {
  console.log("[COINGECKO] getCoinDetailsBySymbol()", { symbol });
  const coins = await searchCoin(symbol);
  const match = pickBestMatch(coins, symbol);

  if (!match) {
    console.warn("[COINGECKO] No exact match found for symbol", { symbol });
    return null;
  }

  console.log("[COINGECKO] Best match selected", {
    symbol,
    coinId: match.id,
    marketCapRank: match.market_cap_rank
  });

  return getCoinDetails(match.id);
}

export function getPlatformDetailForChain(
  details: CoinGeckoCoinDetails,
  chainId: number
): CoinGeckoPlatformDetail | null {
  const platformId = PLATFORM_ID_BY_CHAIN[chainId];
  if (!platformId) {
    console.warn("[COINGECKO] No platform mapping for chain", { chainId });
    return null;
  }

  const detail = details.detail_platforms?.[platformId];
  if (detail && detail.contract_address) {
    console.log("[COINGECKO] Found detail platform match", {
      chainId,
      platformId,
      contract: detail.contract_address,
      decimals: detail.decimal_place
    });
    return detail;
  }

  const contract = details.platforms?.[platformId];
  if (contract) {
    console.log("[COINGECKO] Using fallback platform mapping", {
      chainId,
      platformId,
      contract
    });
    return {
      contract_address: contract,
      decimal_place: null
    };
  }

  console.warn("[COINGECKO] No contract data for platform", {
    chainId,
    platformId
  });
  return null;
}

export function getChainIdForPlatform(platformId: string): number | undefined {
  return PLATFORM_ID_TO_CHAIN[platformId];
}
