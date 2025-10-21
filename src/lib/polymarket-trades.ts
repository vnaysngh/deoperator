export type RawPolymarketTrade = Record<string, unknown>;

export type PolymarketTrade = {
  id: string;
  marketId: string | null;
  marketQuestion: string | null;
  marketSlug?: string | null;
  eventSlug?: string | null;
  outcome?: string | null;
  side: "buy" | "sell" | "unknown";
  taker: boolean;
  price: number | null;
  baseAmount: number | null;
  quoteAmount: number | null;
  notional: number | null;
  timestamp: string;
  txHash?: string | null;
  trader?: string | null;
  traderName?: string | null;
  traderPseudonym?: string | null;
  icon?: string | null;
};

type FetchTradesOptions = {
  limit?: number;
  takerOnly?: boolean;
  sinceMs?: number;
  marketIds?: string[];
  marketConditionIds?: string[];
  eventIds?: string[];
  user?: string;
  side?: "buy" | "sell";
  minNotionalUsd?: number;
  offset?: number;
};

const DATA_API_BASE = "https://data-api.polymarket.com/trades";

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

const toISOString = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "number") {
    const millis = value > 1_000_000_000_000 ? value : value * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
      const millis = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
      const date = new Date(millis);
      return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  return new Date().toISOString();
};

const normalizeSide = (side: unknown): PolymarketTrade["side"] => {
  if (typeof side === "string") {
    const lowered = side.toLowerCase();
    if (lowered === "buy" || lowered === "sell") {
      return lowered;
    }
  }
  return "unknown";
};

const extractMarketQuestion = (trade: RawPolymarketTrade): string | null => {
  if (typeof trade.marketQuestion === "string") {
    return trade.marketQuestion.trim();
  }
  if (typeof trade.market_question === "string") {
    return trade.market_question.trim();
  }
  if (typeof trade.title === "string") {
    return trade.title.trim();
  }
  if (trade.market && typeof trade.market === "object") {
    const market = trade.market as Record<string, unknown>;
    return normalizeString(market.question, market.title, market.name);
  }
  return null;
};

const extractMarketSlug = (trade: RawPolymarketTrade): string | null => {
  if (typeof trade.marketSlug === "string") {
    return trade.marketSlug.trim();
  }
  if (typeof trade.market_slug === "string") {
    return trade.market_slug.trim();
  }
  if (trade.market && typeof trade.market === "object") {
    const market = trade.market as Record<string, unknown>;
    return normalizeString(market.slug, market.market_slug);
  }
  return null;
};

const extractMarketId = (trade: RawPolymarketTrade): string | null => {
  if (typeof trade.marketId === "string") {
    return trade.marketId.trim();
  }
  if (typeof trade.market_id === "string") {
    return trade.market_id.trim();
  }
  if (trade.market && typeof trade.market === "object") {
    const market = trade.market as Record<string, unknown>;
    return normalizeString(market.id, market.marketId, market.market_id);
  }
  return normalizeString(trade.market, trade.market_id);
};

const normalizeTrade = (raw: RawPolymarketTrade): PolymarketTrade => {
  const quoteAmount = normalizeNumber(
    raw.quote_amount,
    raw.quoteAmount,
    raw.quote,
    raw.notional,
    raw.quoteDelta
  );
  const baseAmount = normalizeNumber(
    raw.base_amount,
    raw.baseAmount,
    raw.base,
    raw.size,
    raw.amount
  );

  const marketId = extractMarketId(raw);
  const marketQuestion = extractMarketQuestion(raw);
  const marketSlug = extractMarketSlug(raw);

  const txHash = normalizeString(
    raw.tx_hash,
    raw.transactionHash,
    raw.transaction_hash
  );

  const notional =
    quoteAmount !== null
      ? quoteAmount
      : baseAmount !== null && normalizeNumber(raw.price) !== null
      ? baseAmount * (normalizeNumber(raw.price) ?? 0)
      : null;

  return {
    id:
      normalizeString(
        raw.id,
        raw.trade_id,
        raw.transactionId,
        raw.tx_id
      ) ?? `trade:${Math.random().toString(36).slice(2)}`,
    marketId,
    marketQuestion,
    marketSlug,
    outcome: normalizeString(
      raw.outcome,
      raw.outcomeName,
      raw.outcome_name,
      raw.label
    ),
    side: normalizeSide(raw.side),
    taker:
      typeof raw.taker === "boolean"
        ? raw.taker
        : raw.takerOnly === true ||
          String(raw.takerSide ?? raw.taker ?? "").toLowerCase() === "taker",
    price: normalizeNumber(raw.price, raw.execution_price),
    baseAmount,
    quoteAmount,
    notional,
    timestamp: toISOString(raw.timestamp ?? raw.created_at ?? raw.createdAt),
    txHash,
    eventSlug: normalizeString(raw.eventSlug, raw.event_slug, raw.slug),
    trader: normalizeString(
      raw.proxyWallet,
      raw.proxy_wallet,
      raw.wallet,
      raw.user,
      raw.account
    ),
    traderName: normalizeString(raw.name, raw.userName, raw.username),
    traderPseudonym: normalizeString(raw.pseudonym, raw.handle),
    icon: normalizeString(raw.icon, raw.marketIcon)
  };
};

export async function fetchPolymarketTrades({
  limit = 100,
  takerOnly = true,
  sinceMs,
  marketIds,
  marketConditionIds,
  eventIds,
  user,
  side,
  minNotionalUsd,
  offset
}: FetchTradesOptions = {}): Promise<PolymarketTrade[]> {
  const url = new URL(DATA_API_BASE);
  url.searchParams.set("limit", String(Math.max(limit, 50)));
  if (takerOnly) {
    url.searchParams.set("takerOnly", "true");
  }

  if (offset !== undefined) {
    url.searchParams.set("offset", String(Math.max(0, offset)));
  }

  if (marketIds && marketIds.length > 0) {
    url.searchParams.set("market", marketIds.join(","));
  }

  if (marketConditionIds && marketConditionIds.length > 0) {
    url.searchParams.set("conditionId", marketConditionIds.join(","));
  }

  if (eventIds && eventIds.length > 0) {
    url.searchParams.set("eventId", eventIds.join(","));
  }

  if (user) {
    url.searchParams.set("user", user);
  }

  if (side) {
    url.searchParams.set("side", side.toUpperCase());
  }

  if (minNotionalUsd !== undefined) {
    url.searchParams.set("filterType", "notionalUSD");
    url.searchParams.set("filterAmount", String(minNotionalUsd));
  }

  if (sinceMs) {
    const seconds = Math.floor(sinceMs / 1000);
    url.searchParams.set("minTimestamp", String(seconds));
  }

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "DeOperator/1.0 (polymarket dashboard)"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch trades: ${response.status} ${response.statusText}`
    );
  }

  const json = (await response.json()) as unknown;
  if (!Array.isArray(json)) {
    return [];
  }

  const normalized = json
    .map((item) => normalizeTrade(item as RawPolymarketTrade))
    .filter((trade) => trade.notional !== null && trade.marketQuestion !== null);

  const sinceBoundary = sinceMs
    ? sinceMs
    : Date.now() - 24 * 60 * 60 * 1000;

  const filtered = normalized.filter((trade) => {
    const tradeTime = new Date(trade.timestamp).getTime();
    if (Number.isNaN(tradeTime)) {
      return true;
    }
    return tradeTime >= sinceBoundary;
  });

  filtered.sort(
    (left, right) => (right.notional ?? 0) - (left.notional ?? 0)
  );

  return filtered.slice(0, limit);
}
