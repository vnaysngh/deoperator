import { google } from "@ai-sdk/google";
import { streamText, convertToModelMessages, UIMessage, tool } from "ai";
import { z } from "zod";
import type {
  NormalizedPolymarketMarket,
  PolymarketTimeframe
} from "@/lib/polymarket";
import {
  fetchRecentPolymarketEvents,
  fetchPolymarketMarkets,
  getVolumeForTimeframe
} from "@/lib/polymarket";
import {
  type PolymarketTrade,
  fetchPolymarketTrades
} from "@/lib/polymarket-trades";

export const maxDuration = 30;

const formatCurrency = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
};

const timeframeLabel: Record<PolymarketTimeframe, string> = {
  "24h": "last 24 hours",
  "7d": "last 7 days",
  "30d": "last 30 days"
};

type ToolSuccessResult<
  T extends Record<string, unknown> = Record<string, unknown>
> = T & {
  success: true;
  message: string;
};

type ToolErrorResult<
  T extends Record<string, unknown> = Record<string, unknown>
> = T & {
  success: false;
  userMessage: string;
};

const toolSuccess = <T extends ToolSuccessResult>(result: T): T => result;
const toolError = <T extends ToolErrorResult>(result: T): T => result;

const limitMarketsForPrompt = (
  markets: NormalizedPolymarketMarket[],
  limit = 25
): NormalizedPolymarketMarket[] =>
  markets
    .slice()
    .sort(
      (left, right) => (right.totalVolume ?? 0) - (left.totalVolume ?? 0)
    )
    .slice(0, limit);

const buildMarketsContext = (
  markets: NormalizedPolymarketMarket[],
  timeframe: PolymarketTimeframe,
  activeCategory: string | null
): string => {
  if (markets.length === 0) {
    return "No Polymarket markets were available in the current dataset.";
  }

  const categoryLabel =
    activeCategory && activeCategory !== "all"
      ? `Filtered Category: ${activeCategory}`
      : "Category filter: none";

  const rows = markets
    .map((market, index) => {
      const yesPrice =
        market.lastPriceYes !== null
          ? `${(market.lastPriceYes * 100).toFixed(1)}% YES`
          : "—";
      const endDate = market.endDate
        ? new Date(market.endDate).toISOString()
        : "TBD";
      const timeframeVolume =
        timeframe === "24h"
          ? market.volume24h
          : timeframe === "7d"
          ? market.volume7d ?? market.volume24h
          : market.volume30d ?? market.volume7d ?? market.volume24h;
      const volumeLine = timeframeVolume
        ? `${formatCurrency(timeframeVolume)} ${timeframeLabel[timeframe]}`
        : "Volume data unavailable";
      const change =
        typeof market.volumeChange24h === "number"
          ? `${market.volumeChange24h >= 0 ? "+" : ""}${market.volumeChange24h.toFixed(2)}`
          : "n/a";

      const relatedHighlights = (market.relatedMarkets ?? [])
        .slice(0, 3)
        .map((outcome) => {
          const outcomeYes =
            outcome.yesPrice !== null
              ? `${(outcome.yesPrice * 100).toFixed(1)}% YES`
              : "—";
          return `  • ${outcome.question} | ${formatCurrency(outcome.totalVolume)} total | ${outcomeYes}`;
        })
        .join("\n");

      const outcomeBlock = relatedHighlights
        ? `Key Outcomes:\n${relatedHighlights}`
        : "";

      return `Market ${index + 1}:
Question: ${market.question}
Category: ${market.category}${market.subcategory ? ` → ${market.subcategory}` : ""}
Yes Price: ${yesPrice}
Total Volume: ${formatCurrency(market.totalVolume)}
${volumeLine}
24h Volume Delta: ${change}
Liquidity: ${formatCurrency(market.liquidity)}
Ends: ${endDate}
URL: ${market.url}${outcomeBlock ? `\n${outcomeBlock}` : ""}`;
    })
    .join("\n\n");

  return `POLYMARKET MARKET SNAPSHOT (${timeframeLabel[timeframe].toUpperCase()})

Markets included: ${markets.length}
${categoryLabel}

${rows}`;
};

const formatTrade = (trade: PolymarketTrade, index: number): string => {
  const notional = trade.notional !== null ? `$${trade.notional.toFixed(2)}` : "n/a";
  const size =
    trade.baseAmount !== null ? trade.baseAmount.toFixed(4) : "n/a";
  const price =
    trade.price !== null ? trade.price.toFixed(4) : "n/a";
  const time = new Date(trade.timestamp).toISOString();
  const side = trade.side.toUpperCase();
  const trader =
    trade.traderName ??
    trade.traderPseudonym ??
    (trade.trader ? `${trade.trader.slice(0, 6)}…${trade.trader.slice(-4)}` : "unknown");
  const url = trade.marketSlug
    ? `https://polymarket.com/market/${trade.marketSlug}`
    : trade.eventSlug
    ? `https://polymarket.com/event/${trade.eventSlug}`
    : "https://polymarket.com";

  return `Trade ${index + 1}:
Market: ${trade.marketQuestion ?? "Unknown"}
Outcome: ${trade.outcome ?? "n/a"}
Side: ${side}
Notional: ${notional}
Size: ${size} @ ${price}
Trader: ${trader}
Time: ${time}
URL: ${url}
TxHash: ${trade.txHash ?? "n/a"}`;
};

const buildTradesContext = (trades: PolymarketTrade[]): string => {
  if (trades.length === 0) {
    return "No recent trades were captured in the last 24h.";
  }

  const tradesWithNotional = trades
    .filter((trade) => trade.notional !== null)
    .sort((a, b) => (b.notional ?? 0) - (a.notional ?? 0));

  const topTrade = tradesWithNotional[0];

  const aggregateByTrader = trades.reduce<Record<string, number>>(
    (acc, trade) => {
      const key =
        trade.traderName ??
        trade.traderPseudonym ??
        (trade.trader ? `${trade.trader.slice(0, 6)}…${trade.trader.slice(-4)}` : "unknown");
      const notional = trade.notional ?? 0;
      acc[key] = (acc[key] ?? 0) + notional;
      return acc;
    },
    {}
  );

  const topTraderEntry = Object.entries(aggregateByTrader)
    .sort(([, valueA], [, valueB]) => valueB - valueA)
    .at(0);

  const summaryLines: string[] = [];
  if (topTrade) {
    const traderLabel =
      topTrade.traderName ??
      topTrade.traderPseudonym ??
      (topTrade.trader
        ? `${topTrade.trader.slice(0, 6)}…${topTrade.trader.slice(-4)}`
        : "unknown");
    summaryLines.push(
      `Largest single trade: ${formatCurrency(
        topTrade.notional
      )} ${topTrade.side.toUpperCase()} on “${topTrade.marketQuestion ?? "Unknown"}” by ${traderLabel} (${new Date(
        topTrade.timestamp
      ).toISOString()}). Link: ${
        topTrade.marketSlug
          ? `https://polymarket.com/market/${topTrade.marketSlug}`
          : topTrade.eventSlug
          ? `https://polymarket.com/event/${topTrade.eventSlug}`
          : "https://polymarket.com"
      }`
    );
  }
  if (topTraderEntry) {
    summaryLines.push(
      `Top trader by notional: ${topTraderEntry[0]} with ${formatCurrency(
        topTraderEntry[1] ?? 0
      )} total across the last 24h.`
    );
  }

  const rows = trades
    .slice(0, 25)
    .map((trade, index) => formatTrade(trade, index))
    .join("\n\n");

  return `POLYMARKET TRADE FEED (LAST 24H)

${summaryLines.join("\n")}

${rows}

NOTE: A detailed table of these trades is available in the results section below.`;
};

const TOOL_MAX_TIMEFRAME_MINUTES = 60 * 24 * 7; // one week look-back floor for tool requests

const polymarketTools = {
  getPolymarketTrades: tool({
    description:
      "Fetch Polymarket trades with optional filters including timeframe, market condition IDs, event IDs, minimum notional, side, taker flag, pagination, and trader address.",
    inputSchema: z.object({
      timeframeMinutes: z
        .number()
        .int()
        .min(1)
        .max(TOOL_MAX_TIMEFRAME_MINUTES)
        .optional()
        .describe(
          "Look-back window in minutes for trades. Defaults to 24h if omitted."
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .describe("Maximum number of trades to fetch (default 200)."),
      marketConditionIds: z
        .array(z.string())
        .optional()
        .describe("Condition IDs (0x...) to filter trades by."),
      eventIds: z
        .array(z.string())
        .optional()
        .describe("Event IDs to filter trades by."),
      minNotionalUsd: z
        .number()
        .min(0)
        .optional()
        .describe("Minimum USD notional for trades."),
      side: z
        .enum(["buy", "sell"])
        .optional()
        .describe("Filter trades by side."),
      takerOnly: z
        .boolean()
        .optional()
        .describe("Whether to restrict to taker trades (default true)."),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Pagination offset for the trades feed."),
      user: z
        .string()
        .optional()
        .describe("Filter trades for a specific trader (proxy wallet).")
    }),
    execute: async ({
      timeframeMinutes,
      limit,
      marketConditionIds,
      eventIds,
      minNotionalUsd,
      side,
      takerOnly,
      offset,
      user
    }) => {
      const effectiveLimit = limit ?? 200;
      const effectiveTimeframe = timeframeMinutes ?? 60 * 24;
      const sinceMs =
        effectiveTimeframe !== null
          ? Date.now() - effectiveTimeframe * 60 * 1000
          : undefined;

      try {
        const trades = await fetchPolymarketTrades({
          limit: effectiveLimit,
          marketConditionIds,
          eventIds,
          minNotionalUsd,
          side,
          takerOnly: takerOnly ?? true,
          offset,
          user,
          sinceMs
        });

        return toolSuccess({
          success: true,
          message:
            trades.length > 0
              ? `Fetched ${trades.length} trades from the last ${effectiveTimeframe} minutes.`
              : `No trades matched the requested criteria in the last ${effectiveTimeframe} minutes.`,
          timeframeMinutes: effectiveTimeframe,
          trades
        });
      } catch (error) {
        console.error("[POLYMARKET CHAT] getPolymarketTrades tool failed:", error);
        return toolError({
          success: false,
          userMessage:
            "I couldn't pull the latest trades. Want to try again in a moment?",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  }),
  getPolymarketEvents: tool({
    description:
      "Fetch recently created Polymarket markets (events) with optional category/tag filters.",
    inputSchema: z.object({
      timeframeMinutes: z
        .number()
        .int()
        .min(1)
        .max(TOOL_MAX_TIMEFRAME_MINUTES)
        .optional()
        .describe(
          "Look-back window in minutes for newly created markets. Defaults to 60."
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Maximum number of markets to fetch (default 20)."),
      category: z
        .string()
        .optional()
        .describe("Optional category label to filter on (e.g., 'crypto')."),
      tag: z
        .string()
        .optional()
        .describe("Optional tag to filter on (e.g., 'sports').")
    }),
    execute: async ({ timeframeMinutes, limit, category, tag }) => {
      const effectiveLimit = limit ?? 20;
      const effectiveTimeframe = timeframeMinutes ?? 60;
      const sinceMs = Date.now() - effectiveTimeframe * 60 * 1000;

      try {
        const events = await fetchRecentPolymarketEvents({
          sinceMs,
          limit: effectiveLimit,
          category,
          tag
        });

        return toolSuccess({
          success: true,
          message:
            events.length > 0
              ? `Found ${events.length} markets created in the last ${effectiveTimeframe} minutes.`
              : `No markets were created in the last ${effectiveTimeframe} minutes that matched the filters.`,
          timeframeMinutes: effectiveTimeframe,
          markets: events
        });
      } catch (error) {
        console.error("[POLYMARKET CHAT] getPolymarketEvents tool failed:", error);
        return toolError({
          success: false,
          userMessage:
            "I couldn't load the latest markets right now. Can we try again shortly?",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  }),
  getPolymarketMarkets: tool({
    description:
      "Fetch the latest Polymarket markets, filtered by category, tag, activity, and volume thresholds.",
    inputSchema: z.object({
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("Maximum number of markets to return (default 40)."),
      category: z
        .string()
        .optional()
        .describe("Restrict to markets matching this category label."),
      tag: z
        .string()
        .optional()
        .describe("Restrict to markets containing this tag."),
      includeInactive: z
        .boolean()
        .optional()
        .describe("Include closed/resolved/expired markets (default false)."),
      timeframe: z
        .enum(["24h", "7d", "30d"] as const)
        .optional()
        .describe("Which volume timeframe to sort/filter against (default 24h)."),
      minVolumeUsd: z
        .number()
        .min(0)
        .optional()
        .describe(
          "Minimum USD volume in the selected timeframe for markets to be included."
        )
    }),
    execute: async ({
      limit,
      category,
      tag,
      includeInactive,
      timeframe,
      minVolumeUsd
    }) => {
      try {
        const { markets, source } = await fetchPolymarketMarkets();
        const normalizedCategory = category?.toLowerCase();
        const normalizedTag = tag?.toLowerCase();
        const effectiveTimeframe: PolymarketTimeframe = timeframe ?? "24h";
        const effectiveLimit = limit ?? 40;

        let filtered = markets.slice();

        if (!includeInactive) {
          filtered = filtered.filter(
            (market) => market.isActive && !market.isResolved && !market.isExpired
          );
        }

        if (normalizedCategory) {
          filtered = filtered.filter((market) => {
            const candidates = [
              market.category,
              market.subcategory,
              ...(market.tags ?? [])
            ].filter(Boolean) as string[];
            return candidates.some(
              (value) => value.toLowerCase() === normalizedCategory
            );
          });
        }

        if (normalizedTag) {
          filtered = filtered.filter((market) =>
            (market.tags ?? []).some(
              (value) => value.toLowerCase() === normalizedTag
            )
          );
        }

        if (typeof minVolumeUsd === "number") {
          filtered = filtered.filter((market) => {
            const volume = getVolumeForTimeframe(market, effectiveTimeframe);
            return volume !== null && volume >= minVolumeUsd;
          });
        }

        filtered.sort((left, right) => {
          const rightVolume =
            getVolumeForTimeframe(right, effectiveTimeframe) ?? 0;
          const leftVolume =
            getVolumeForTimeframe(left, effectiveTimeframe) ?? 0;
          return rightVolume - leftVolume;
        });

        const limited = filtered.slice(0, effectiveLimit);

        return toolSuccess({
          success: true,
          message:
            limited.length > 0
              ? `Fetched ${limited.length} markets from the ${source} feed.`
              : "No markets matched the requested filters.",
          timeframe: effectiveTimeframe,
          source,
          markets: limited
        });
      } catch (error) {
        console.error("[POLYMARKET CHAT] getPolymarketMarkets tool failed:", error);
        return toolError({
          success: false,
          userMessage:
            "I couldn't refresh the Polymarket board right now. Let's try once more in a bit.",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  })
} as const;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const timeframeHeader = (req.headers.get("x-polymarket-timeframe") ??
    "24h") as PolymarketTimeframe;
  const activeCategory =
    req.headers.get("x-polymarket-category") ?? "all";
  const rawMarkets = req.headers.get("x-polymarket-markets") ?? "[]";
  const rawTrades = req.headers.get("x-polymarket-trades") ?? "[]";

  let markets: NormalizedPolymarketMarket[] = [];
  try {
    const parsed = JSON.parse(rawMarkets);
    if (Array.isArray(parsed)) {
      markets = parsed.filter(
        (item) =>
          item &&
          typeof item === "object" &&
          "question" in item &&
          "category" in item
      ) as NormalizedPolymarketMarket[];
    }
  } catch (parseError) {
      console.error("[POLYMARKET CHAT] Failed to parse market payload:", parseError);
  }

  if (markets.length === 0) {
    try {
      const fetched = await fetchPolymarketMarkets();
      markets = fetched.markets;
    } catch (marketError) {
      console.error("[POLYMARKET CHAT] Fallback market fetch failed:", marketError);
    }
  }

  let trades: PolymarketTrade[] = [];
  try {
    const parsedTrades = JSON.parse(rawTrades);
    if (Array.isArray(parsedTrades)) {
      trades = parsedTrades
        .filter(
          (item) =>
            item &&
            typeof item === "object" &&
            "marketQuestion" in item &&
            "notional" in item
        )
        .map((item) => item as PolymarketTrade);
    }
  } catch (tradeError) {
    console.error("[POLYMARKET CHAT] Failed to parse trade payload:", tradeError);
  }

  if (trades.length === 0) {
    try {
      trades = await fetchPolymarketTrades({
        limit: 50,
        takerOnly: true,
        sinceMs: Date.now() - 24 * 60 * 60 * 1000
      });
    } catch (fallbackError) {
      console.error("[POLYMARKET CHAT] Fallback trade fetch failed:", fallbackError);
    }
  }

  const summarizedMarkets = limitMarketsForPrompt(markets, 20);
  const systemContext = buildMarketsContext(
    summarizedMarkets,
    timeframeHeader,
    activeCategory
  );
  const tradesContext = buildTradesContext(trades);

  const systemPrompt = `You are an AI agent embedded inside a prediction market trading terminal. Your job is to interpret live data from Polymarket and surface meaningful insights, narratives, and trading signals for the user.

${systemContext}

${tradesContext}

Assistant Responsibilities:
1. Highlight notable movements in volume, liquidity, and price probability.
2. Compare markets when useful (e.g., politics vs crypto vs sports).
3. Flag markets that are about to expire or have thin liquidity.
4. Translate probabilities into intuitive language (e.g., "markets imply a 63% chance").
5. Surface the largest trades/bets in the last 24 hours using the trade feed. Report both the biggest single trade and the trader with the highest aggregate notional whenever trades exist; if the feed is empty, state that explicitly.
6. Suggest follow-up investigations or hedges when relevant.

Guidelines:
- ALWAYS ground answers in the data provided.
- Quote specific market names and link to their Polymarket URLs.
- Mention timeframe (“in the last 24h/7d/30d”) when referencing volume or change.
- If the user asks for a subset (e.g., “only crypto”), filter with the available tags/category information.
- Use the trades feed when users ask about biggest bets, whale activity, or specific users.
- When you need custom trade slices (specific market, timeframe, or minimum size), call the getPolymarketTrades tool with the appropriate filters.
- When you need recently created markets, call the getPolymarketEvents tool (e.g., timeframeMinutes=30, limit=5).
- When you need a refreshed market snapshot or custom filters beyond the cached dataset, call the getPolymarketMarkets tool.
- If data is missing for a field, disclose that it’s unavailable instead of guessing.
- Maintain the minimal, terminal-inspired tone consistent with the UI (concise but insightful).
- 🚨 After every tool call you MUST send a natural language response to the user summarizing the relevant findings (even when the tool returns zero results). Never end the turn while waiting for the UI to render tool data by itself—the UI only shows what you say.

Example style:
"Top movers by 24h flow:
• Trump vs Biden: $1.8M traded | 63% YES | Ends 2024-11-05
• BTC > $80k on Dec 31: $920K traded | 42% YES | Ends 2024-12-31
Liquidity remains deepest in the Presidential complex, while crypto markets are thinner (<$120K each)."

Be analytical and crisp.`;

  try {
    const result = streamText({
      model: google("gemini-2.5-flash"),
      messages: convertToModelMessages(messages),
      system: systemPrompt,
      tools: polymarketTools,
      toolChoice: "auto",
      onStepFinish: ({ text, toolCalls, finishReason }) => {
        console.log("[POLYMARKET CHAT] Step finish", {
          textLength: text?.length ?? 0,
          toolCalls: toolCalls?.length ?? 0,
          finishReason
        });
      },
      onFinish: ({ text, toolCalls, finishReason }) => {
        console.log("[POLYMARKET CHAT] Final finish", {
          textLength: text?.length ?? 0,
          toolCalls: toolCalls?.length ?? 0,
          finishReason
        });
      }
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[POLYMARKET CHAT] Streaming error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process Polymarket chat"
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
}
