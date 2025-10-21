import {
  fetchPolymarketMarkets,
  getCacheHeaders
} from "@/lib/polymarket";
import {
  fetchPolymarketTrades,
  type PolymarketTrade
} from "@/lib/polymarket-trades";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [marketsResult, tradesResult] = await Promise.allSettled([
      fetchPolymarketMarkets(),
      fetchPolymarketTrades({
        limit: 50,
        takerOnly: true,
        sinceMs: Date.now() - 24 * 60 * 60 * 1000
      })
    ]);

    if (marketsResult.status !== "fulfilled") {
      throw marketsResult.reason;
    }

    const { markets, source } = marketsResult.value;

    const trades: PolymarketTrade[] =
      tradesResult.status === "fulfilled" ? tradesResult.value : [];

    return new Response(
      JSON.stringify({
        markets,
        source,
        trades
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...getCacheHeaders()
        }
      }
    );
  } catch (error) {
    console.error("[API] Polymarket markets fetch failed:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to load Polymarket markets"
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          ...getCacheHeaders()
        }
      }
    );
  }
}
