import {
  fetchPolymarketMarkets,
  getCacheHeaders
} from "@/lib/polymarket";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { markets, source } = await fetchPolymarketMarkets();

    return new Response(
      JSON.stringify({
        markets,
        source
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
