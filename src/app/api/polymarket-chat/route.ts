import { google } from "@ai-sdk/google";
import { streamText, convertToModelMessages, UIMessage } from "ai";
import type {
  NormalizedPolymarketMarket,
  PolymarketTimeframe
} from "@/lib/polymarket";

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

      return `Market ${index + 1}:
Question: ${market.question}
Category: ${market.category}${market.subcategory ? ` → ${market.subcategory}` : ""}
Yes Price: ${yesPrice}
Total Volume: ${formatCurrency(market.totalVolume)}
${volumeLine}
24h Volume Delta: ${change}
Liquidity: ${formatCurrency(market.liquidity)}
Ends: ${endDate}
URL: ${market.url}`;
    })
    .join("\n\n");

  return `POLYMARKET MARKET SNAPSHOT (${timeframeLabel[timeframe].toUpperCase()})

Markets included: ${markets.length}
${categoryLabel}

${rows}`;
};

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const timeframeHeader = (req.headers.get("x-polymarket-timeframe") ??
    "24h") as PolymarketTimeframe;
  const activeCategory =
    req.headers.get("x-polymarket-category") ?? "all";
  const rawMarkets = req.headers.get("x-polymarket-markets") ?? "[]";

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

  const summarizedMarkets = limitMarketsForPrompt(markets, 20);
  const systemContext = buildMarketsContext(
    summarizedMarkets,
    timeframeHeader,
    activeCategory
  );

  const systemPrompt = `You are an AI agent embedded inside a prediction market trading terminal. Your job is to interpret live data from Polymarket and surface meaningful insights, narratives, and trading signals for the user.

${systemContext}

Assistant Responsibilities:
1. Highlight notable movements in volume, liquidity, and price probability.
2. Compare markets when useful (e.g., politics vs crypto vs sports).
3. Flag markets that are about to expire or have thin liquidity.
4. Translate probabilities into intuitive language (e.g., "markets imply a 63% chance").
5. Suggest follow-up investigations or hedges when relevant.

Guidelines:
- ALWAYS ground answers in the data provided.
- Quote specific market names and link to their Polymarket URLs.
- Mention timeframe (“in the last 24h/7d/30d”) when referencing volume or change.
- If the user asks for a subset (e.g., “only crypto”), filter with the available tags/category information.
- If data is missing for a field, disclose that it’s unavailable instead of guessing.
- Maintain the minimal, terminal-inspired tone consistent with the UI (concise but insightful).

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
      system: systemPrompt
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
