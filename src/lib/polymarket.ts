export type RawPolymarketMarket = Record<string, unknown>;

export type PolymarketTimeframe = "24h" | "7d" | "30d";

export type NormalizedPolymarketMarket = {
  id: string;
  question: string;
  category: string;
  subcategory?: string | null;
  tags: string[];
  slug?: string | null;
  url: string;
  description?: string | null;
  status?: string | null;
  isActive: boolean;
  isResolved: boolean;
  isExpired: boolean;
  totalVolume: number | null;
  volume24h: number | null;
  volume7d: number | null;
  volume30d: number | null;
  volumeChange24h: number | null;
  liquidity: number | null;
  openInterest: number | null;
  lastPriceYes: number | null;
  lastPriceNo: number | null;
  priceChange24h: number | null;
  endDate: string | null;
  createdAt: string | null;
  lastUpdated: string | null;
  yesShares?: number | null;
  noShares?: number | null;
  eventId?: string | null;
  eventSlug?: string | null;
  eventTitle?: string | null;
  eventVolume?: number | null;
  eventTags?: string[];
  relatedMarkets?: Array<{
    question: string;
    totalVolume: number | null;
    volume24h: number | null;
    liquidity: number | null;
    yesPrice: number | null;
    noPrice: number | null;
    slug?: string | null;
    url: string;
  }>;
};

type FetchPolymarketResult = {
  markets: NormalizedPolymarketMarket[];
  source: "primary" | "fallback";
};

const EVENTS_ENDPOINT =
  "https://gamma-api.polymarket.com/events?limit=120&order=volume&ascending=false&closed=false";

const MARKETS_ENDPOINT =
  "https://gamma-api.polymarket.com/markets?limit=200&active=true&closed=false&archived=false";

const FALLBACK_POLYMARKET_URL = "https://prediction.llama.fi/markets";

const cacheControlHeader = "public, s-maxage=60, stale-while-revalidate=300";

const PRIMARY_CATEGORY_PRIORITY = [
  "Politics",
  "US Election",
  "World Elections",
  "Elections",
  "Economy",
  "Finance",
  "Crypto",
  "Markets",
  "Sports",
  "Soccer",
  "Baseball",
  "Football",
  "Basketball",
  "Hockey",
  "Tennis",
  "Golf",
  "Entertainment",
  "Culture",
  "Tech",
  "Science",
  "World",
  "Geopolitics",
  "Weather"
] as const;

const IGNORED_TAG_LABELS = new Set([
  "All",
  "Earn 4%",
  "Earn 8%",
  "Earn 12%",
  "Latest",
  "Breaking"
]);

type RawGammaTag = {
  id?: string;
  label?: string;
  slug?: string;
  forceShow?: boolean;
  forceHide?: boolean;
};

type RawGammaEventMarket = {
  id?: string;
  slug?: string;
  question?: string;
  outcomes?: string;
  outcomePrices?: string;
  volume?: string | number;
  volume24hr?: string | number;
  volume1wk?: string | number;
  volume1mo?: string | number;
  liquidity?: string | number;
  active?: boolean;
  closed?: boolean;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
  lastTradePrice?: string | number;
  bestBid?: string | number;
  bestAsk?: string | number;
};

type RawGammaEvent = {
  id?: string;
  slug?: string;
  title?: string;
  description?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
  volume?: string | number;
  volume24hr?: string | number;
  volume1wk?: string | number;
  volume1mo?: string | number;
  liquidity?: string | number;
  liquidityClob?: string | number;
  liquidityAmm?: string | number;
  openInterest?: string | number;
  closed?: boolean;
  tags?: RawGammaTag[];
  markets?: RawGammaEventMarket[];
};

const normalizeNumber = (...values: Array<unknown>): number | null => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};

const normalizeString = (...values: Array<unknown>): string | null => {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const toISOStringOrNull = (value: unknown): string | null => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
      const date = new Date(numeric);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
};

const generateRandomId = () => {
  const maybeCrypto =
    (typeof globalThis !== "undefined"
      ? (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
      : undefined) ?? undefined;

  if (maybeCrypto?.randomUUID) {
    try {
      return maybeCrypto.randomUUID();
    } catch {
      // Ignore and use math fallback.
    }
  }

  return `poly-${Math.random().toString(36).slice(2, 10)}`;
};

const buildMarketUrl = (slug: string | null, id: string): string => {
  if (slug) {
    return `https://polymarket.com/market/${slug}`;
  }
  return `https://polymarket.com/market/${id}`;
};

const normalizeTagLabel = (label: string): string => label.trim();

const selectPrimaryCategory = (tags: RawGammaTag[]): string | null => {
  const labels = tags
    .map((tag) => tag.label)
    .filter((label): label is string => typeof label === "string")
    .map(normalizeTagLabel)
    .filter((label) => label.length > 0 && !IGNORED_TAG_LABELS.has(label));

  if (labels.length === 0) {
    return null;
  }

  for (const preferred of PRIMARY_CATEGORY_PRIORITY) {
    const match = labels.find(
      (label) => label.toLowerCase() === preferred.toLowerCase()
    );
    if (match) {
      return preferred;
    }
  }

  const alternative = labels.find((label) => {
    const sanitized = label.replace(/[^\w\s]/g, "").trim();
    if (!sanitized) return false;
    const words = sanitized.split(/\s+/);
    if (words.length === 1) {
      return words[0].length >= 3 && words[0].length <= 20;
    }
    if (words.length === 2) {
      return words.every((word) => word.length >= 3 && word.length <= 15);
    }
    return false;
  });

  return alternative ?? labels[0] ?? null;
};

const selectSubcategory = (
  tags: RawGammaTag[],
  primaryCategory: string | null
): string | null => {
  const labels = tags
    .map((tag) => tag.label)
    .filter((label): label is string => typeof label === "string")
    .map(normalizeTagLabel)
    .filter((label) => label.length > 0 && !IGNORED_TAG_LABELS.has(label));

  if (labels.length <= 1) {
    return null;
  }

  const distinct = labels.filter(
    (label) =>
      label !== primaryCategory &&
      label.toLowerCase() !== primaryCategory?.toLowerCase()
  );

  return distinct[0] ?? null;
};

const parseOutcomePrices = (
  outcomes: string | undefined,
  outcomePrices: string | undefined
): { yes: number | null; no: number | null } => {
  try {
    if (outcomePrices) {
      const parsed = JSON.parse(outcomePrices) as Array<string | number>;
      if (Array.isArray(parsed) && parsed.length >= 2) {
        const yes = Number(parsed[0]);
        const no = Number(parsed[1]);
        return {
          yes: Number.isFinite(yes) ? yes : null,
          no: Number.isFinite(no) ? no : null
        };
      }
    }

    if (outcomes) {
      const parsedOutcomes = JSON.parse(outcomes) as string[];
      if (Array.isArray(parsedOutcomes) && parsedOutcomes.length === 2) {
        const yesIndex = parsedOutcomes.findIndex((item) =>
          item.toLowerCase().includes("yes")
        );
        if (yesIndex !== -1 && outcomePrices) {
          const parsedPrices = JSON.parse(outcomePrices) as Array<
            string | number
          >;
          const price = Number(parsedPrices[yesIndex]);
          if (Number.isFinite(price)) {
            return {
              yes: price,
              no: Number.isFinite(1 - price)
                ? Number((1 - price).toFixed(4))
                : null
            };
          }
        }
      }
    }
  } catch {
    // ignore parse errors
  }

  return { yes: null, no: null };
};

const flattenGammaEvents = (
  events: RawGammaEvent[]
): NormalizedPolymarketMarket[] => {
  const aggregated: NormalizedPolymarketMarket[] = [];

  for (const event of events) {
    if (!event) continue;

    const eventMarkets = Array.isArray(event.markets) ? event.markets : [];

    const primaryCategory =
      selectPrimaryCategory(event.tags ?? []) ?? "General";
    const subcategory = selectSubcategory(event.tags ?? [], primaryCategory);
    const tagLabels = (event.tags ?? [])
      .map((tag) => tag.label)
      .filter((label): label is string => typeof label === "string")
      .map(normalizeTagLabel)
      .filter((label) => label.length > 0);

    const aggregatedVolume =
      normalizeNumber(event.volume) ??
      (() => {
        const sum = eventMarkets.reduce((total, market) => {
          const value = normalizeNumber(market.volume);
          return total + (value ?? 0);
        }, 0);
        return sum > 0 ? sum : null;
      })();

    const aggregatedLiquidity =
      normalizeNumber(
        event.liquidity,
        event.liquidityClob,
        event.liquidityAmm
      ) ??
      (() => {
        const sum = eventMarkets.reduce((total, market) => {
          const value = normalizeNumber(market.liquidity);
          return total + (value ?? 0);
        }, 0);
        return sum > 0 ? sum : null;
      })();

    const sortedEventMarkets = eventMarkets
      .slice()
      .sort(
        (left, right) =>
          (normalizeNumber(right.volume) ?? 0) -
          (normalizeNumber(left.volume) ?? 0)
      );

    let favouriteYes: number | null = null;
    let favouriteNo: number | null = null;
    let referenceMarket: RawGammaEventMarket | null = null;

    for (const market of sortedEventMarkets) {
      const { yes, no } = parseOutcomePrices(
        market.outcomes,
        market.outcomePrices
      );
      if (yes !== null && (favouriteYes === null || yes > favouriteYes)) {
        favouriteYes = yes;
        favouriteNo =
          no !== null
            ? no
            : Number.isFinite(1 - yes)
            ? Number((1 - yes).toFixed(4))
            : null;
        referenceMarket = market;
      }
    }

    const endDate = event.endDate ?? referenceMarket?.endDate ?? null;
    const createdAt = event.createdAt ?? referenceMarket?.createdAt ?? null;
    const updatedAt = event.updatedAt ?? referenceMarket?.updatedAt ?? null;
    const slug = normalizeString(event.slug, referenceMarket?.slug);
    const description = normalizeString(
      event.description,
      (referenceMarket as { description?: unknown } | undefined)?.description
    );

    const endTimestamp = endDate ? new Date(endDate).getTime() : null;
    const isExpired =
      endTimestamp !== null &&
      !Number.isNaN(endTimestamp) &&
      endTimestamp < Date.now();

    const marketId =
      event.id ??
      normalizeString(
        referenceMarket ? referenceMarket.id : undefined,
        referenceMarket ? referenceMarket.slug : undefined
      ) ??
      generateRandomId();

    const eventIsClosed = event.closed === true;

    aggregated.push({
      id: marketId,
      question:
        event.title ??
        normalizeString(referenceMarket?.question, referenceMarket?.slug) ??
        "Untitled Market",
      category: primaryCategory,
      subcategory,
      tags: Array.from(
        new Set(
          [...tagLabels, primaryCategory, subcategory ?? null]
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
        )
      ),
      slug,
      url: slug
        ? `https://polymarket.com/event/${slug}`
        : buildMarketUrl(normalizeString(referenceMarket?.slug), marketId),
      description,
      status: eventIsClosed ? "closed" : "active",
      isActive: !eventIsClosed,
      isResolved: eventIsClosed,
      isExpired,
      totalVolume: aggregatedVolume,
      volume24h: normalizeNumber(event.volume24hr),
      volume7d: normalizeNumber(event.volume1wk),
      volume30d: normalizeNumber(event.volume1mo),
      volumeChange24h: null,
      liquidity: aggregatedLiquidity,
      openInterest: normalizeNumber(event.openInterest),
      lastPriceYes: favouriteYes,
      lastPriceNo: favouriteNo,
      priceChange24h: null,
      endDate: toISOStringOrNull(endDate),
      createdAt: toISOStringOrNull(createdAt),
      lastUpdated: toISOStringOrNull(updatedAt),
      yesShares: null,
      noShares: null,
      eventId: event.id ?? null,
      eventSlug: event.slug ?? null,
      eventTitle: event.title ?? null,
      eventVolume: aggregatedVolume,
      eventTags: tagLabels,
      relatedMarkets: sortedEventMarkets.slice(0, 5).map((market) => {
        const { yes, no } = parseOutcomePrices(
          market.outcomes,
          market.outcomePrices
        );
        const marketSlug = normalizeString(market.slug);
        const marketIdentifier =
          normalizeString(market.id, market.slug) ?? generateRandomId();
        const marketUrl = marketSlug
          ? buildMarketUrl(marketSlug, marketIdentifier)
          : buildMarketUrl(null, marketIdentifier);

        return {
          question:
            normalizeString(market.question, market.slug) ?? "Untitled outcome",
          totalVolume: normalizeNumber(market.volume),
          volume24h: normalizeNumber(market.volume24hr),
          liquidity: normalizeNumber(market.liquidity),
          yesPrice: yes,
          noPrice: no,
          slug: marketSlug,
          url: marketUrl
        };
      })
    });
  }

  return aggregated;
};

const firstNonEmptyArray = (...values: Array<unknown>): string[] => {
  for (const value of values) {
    if (Array.isArray(value)) {
      const filtered = value
        .map((item) => {
          if (typeof item === "string") {
            return item.trim();
          }
          if (item && typeof item === "object" && "name" in item) {
            const name = (item as { name?: string }).name;
            if (typeof name === "string") {
              return name.trim();
            }
          }
          return "";
        })
        .filter((entry) => entry.length > 0);
      if (filtered.length > 0) {
        return filtered;
      }
    }
  }
  return [];
};

const normalizeMarketPayload = (
  market: RawPolymarketMarket
): NormalizedPolymarketMarket => {
  const id =
    normalizeString(
      market.id,
      market.market_id,
      market.marketId,
      market.conditionId,
      market.slug
    ) ?? generateRandomId();

  const slug = normalizeString(
    market.slug,
    market.market_slug,
    market.url ? new URL(String(market.url)).pathname.split("/").pop() : null
  );

  const question =
    normalizeString(
      market.question,
      market.title,
      market.market,
      market.name
    ) ?? "Untitled Market";

  const category =
    normalizeString(
      market.category,
      market.mainCategory,
      market.section,
      Array.isArray(market.categories) ? market.categories[0] : null
    ) ?? "General";

  const subcategory = normalizeString(
    market.subcategory,
    market.topic,
    Array.isArray(market.categories) ? market.categories[1] : null
  );

  const tags = firstNonEmptyArray(
    market.tags,
    market.labels,
    market.topics,
    market.categories
  );

  const { yes, no } = parseOutcomePrices(
    market.outcomes as string | undefined,
    market.outcomePrices as string | undefined
  );

  return {
    id,
    question,
    category,
    subcategory,
    tags,
    slug,
    url: buildMarketUrl(slug, id),
    description: normalizeString(
      market.description,
      market.summary,
      market.context
    ),
    status: normalizeString(market.status, market.state, market.market_status),
    isActive: Boolean(
      market.active !== false &&
        market.closed !== true &&
        market.archived !== true
    ),
    isResolved: market.closed === true || market.resolved === true,
    totalVolume: normalizeNumber(
      market.volume,
      market.totalVolume,
      market.volumeTotal
    ),
    volume24h: normalizeNumber(
      market.volume24hr,
      market.volume24h,
      market.volume_24h
    ),
    volume7d: normalizeNumber(market.volume7d, market.volume_7d),
    volume30d: normalizeNumber(market.volume30d, market.volume_30d),
    volumeChange24h: normalizeNumber(
      market.volumeChange24h,
      market.volume_change_24h
    ),
    liquidity: normalizeNumber(market.liquidity, market.liquidity_in_usd),
    openInterest: normalizeNumber(market.open_interest, market.openInterest),
    lastPriceYes: yes,
    lastPriceNo: no,
    priceChange24h: normalizeNumber(
      market.priceChange24h,
      market.price_change_24h
    ),
    endDate: toISOStringOrNull(
      market.endDate ??
        market.end_time ??
        market.closeDate ??
        market.closeTime ??
        market.expiresAt
    ),
    createdAt: toISOStringOrNull(
      market.created_at ?? market.createdAt ?? market.createdDate
    ),
    lastUpdated: toISOStringOrNull(
      market.updated_at ?? market.updatedAt ?? market.lastUpdated
    ),
    yesShares: normalizeNumber(market.yesShares, market.sharesYes),
    noShares: normalizeNumber(market.noShares, market.sharesNo),
    isExpired: (() => {
      const timestamp = market.endDate
        ? new Date(String(market.endDate)).getTime()
        : null;
      if (timestamp === null || Number.isNaN(timestamp)) {
        return false;
      }
      return timestamp < Date.now();
    })(),
    eventId: null,
    eventSlug: null,
    eventTitle: null,
    eventVolume: null,
    eventTags: tags
  };
};

const extractMarketsArray = (payload: unknown): RawPolymarketMarket[] => {
  if (Array.isArray(payload)) {
    return payload as RawPolymarketMarket[];
  }

  if (payload && typeof payload === "object") {
    const candidates: unknown[] = [
      (payload as { markets?: unknown }).markets,
      (payload as { data?: unknown }).data,
      (payload as { results?: unknown }).results,
      (payload as { items?: unknown }).items
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate as RawPolymarketMarket[];
      }
    }
  }

  return [];
};

export const normalizePolymarketMarkets = (
  payload: unknown
): NormalizedPolymarketMarket[] => {
  const markets = extractMarketsArray(payload);
  return markets.map((market) => normalizeMarketPayload(market));
};

export async function fetchPolymarketMarkets(): Promise<FetchPolymarketResult> {
  const requestInit: RequestInit = {
    headers: {
      "User-Agent": "BasedOperator/1.0 (polymarket dashboard)"
    },
    cache: "no-store",
    next: {
      revalidate: 120
    }
  };

  try {
    const eventsResponse = await fetch(EVENTS_ENDPOINT, requestInit);
    if (eventsResponse.ok) {
      const eventsJson = (await eventsResponse.json()) as RawGammaEvent[];
      if (Array.isArray(eventsJson) && eventsJson.length > 0) {
        const flattened = flattenGammaEvents(eventsJson)
          .filter((market) => market.totalVolume !== null)
          .sort(
            (left, right) => (right.totalVolume ?? 0) - (left.totalVolume ?? 0)
          );

        if (flattened.length > 0) {
          return {
            markets: flattened,
            source: "primary"
          };
        }
      }
    }
  } catch (eventError) {
    console.error("[POLYMARKET] Event market fetch failed:", eventError);
  }

  try {
    const response = await fetch(MARKETS_ENDPOINT, requestInit);
    if (!response.ok) {
      throw new Error(
        `Primary Polymarket market fetch failed with status ${response.status}`
      );
    }
    const json = await response.json();
    return {
      markets: normalizePolymarketMarkets(json),
      source: "primary"
    };
  } catch (primaryError) {
    console.error("[POLYMARKET] Market fetch failed:", primaryError);
  }

  try {
    const fallbackResponse = await fetch(FALLBACK_POLYMARKET_URL, requestInit);
    if (!fallbackResponse.ok) {
      throw new Error(
        `Fallback Polymarket API failed with status ${fallbackResponse.status}`
      );
    }
    const fallbackJson = await fallbackResponse.json();
    return {
      markets: normalizePolymarketMarkets(fallbackJson),
      source: "fallback"
    };
  } catch (fallbackError) {
    console.error("[POLYMARKET] Fallback market fetch failed:", fallbackError);
    throw fallbackError instanceof Error
      ? fallbackError
      : new Error("Unable to fetch Polymarket markets");
  }
}

export function getCacheHeaders(): HeadersInit {
  return {
    "Cache-Control": cacheControlHeader
  };
}

export function getVolumeForTimeframe(
  market: NormalizedPolymarketMarket,
  timeframe: PolymarketTimeframe
): number | null {
  if (timeframe === "24h") {
    return market.volume24h ?? null;
  }
  if (timeframe === "7d") {
    return market.volume7d ?? market.volume24h ?? null;
  }
  return market.volume30d ?? market.volume7d ?? market.volume24h ?? null;
}

export function get24hVolumeAccent(
  market: NormalizedPolymarketMarket
): "positive" | "negative" | "neutral" {
  const change = market.volumeChange24h;
  if (change === null) return "neutral";
  if (change > 0) return "positive";
  if (change < 0) return "negative";
  return "neutral";
}

export { EVENTS_ENDPOINT as DEFAULT_POLYMARKET_URL, FALLBACK_POLYMARKET_URL };

type FetchRecentEventsOptions = {
  sinceMs?: number;
  limit?: number;
  category?: string;
  tag?: string;
};

export async function fetchRecentPolymarketEvents({
  sinceMs,
  limit = 50,
  category,
  tag
}: FetchRecentEventsOptions = {}): Promise<NormalizedPolymarketMarket[]> {
  const url = new URL(EVENTS_ENDPOINT);
  url.searchParams.set("limit", String(Math.max(limit, 20)));
  url.searchParams.set("order", "id");
  url.searchParams.set("ascending", "false");
  url.searchParams.set("closed", "false");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "BasedOperator/1.0 (polymarket dashboard)"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch recent Polymarket events: ${response.status}`
    );
  }

  const events = (await response.json()) as RawGammaEvent[];

  const sinceTimestamp = sinceMs ?? null;
  const loweredCategory = category?.toLowerCase();
  const loweredTag = tag?.toLowerCase();

  const filteredEvents = events.filter((event) => {
    const createdAt = event.createdAt;
    if (sinceTimestamp) {
      const createdMs = createdAt ? new Date(createdAt).getTime() : null;
      if (createdMs === null || Number.isNaN(createdMs)) {
        return false;
      }
      if (createdMs < sinceTimestamp) {
        return false;
      }
    }

    if (loweredCategory) {
      const hasCategory = (event.tags ?? []).some((eventTag) => {
        const label = eventTag.label?.toLowerCase();
        const slug = eventTag.slug?.toLowerCase();
        return label === loweredCategory || slug === loweredCategory;
      });
      if (!hasCategory) {
        return false;
      }
    }

    if (loweredTag) {
      const matchesTag = (event.tags ?? []).some((eventTag) => {
        const label = eventTag.label?.toLowerCase();
        const slug = eventTag.slug?.toLowerCase();
        return label === loweredTag || slug === loweredTag;
      });
      if (!matchesTag) {
        return false;
      }
    }

    return true;
  });

  const normalized = flattenGammaEvents(filteredEvents)
    .filter((market) => market.createdAt !== null)
    .sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt
        ? new Date(right.createdAt).getTime()
        : 0;
      return rightTime - leftTime;
    });

  return normalized.slice(0, limit);
}
