import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MORALIS_API_KEY = process.env.MORALIS_API_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImQ2MmMyODYxLTIyODQtNGFhYy04OGIwLWI4ZmNlNmQwZjMxYSIsIm9yZ0lkIjoiNDAyNTE4IiwidXNlcklkIjoiNDEzNjIwIiwidHlwZUlkIjoiMDhjMmY1ZjEtZGQ2Yy00MDM3LTljODktODNkN2Y5NGFkYWYxIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3MjI2NzM0MjksImV4cCI6NDg3ODQzMzQyOX0.Kgki3X4CFtxWQFGzh5AEbqx-tZSijyNhGp7Tic-8DRc";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const walletAddress = searchParams.get("address");
    const chain = searchParams.get("chain") || "eth";

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    const url = `https://deep-index.moralis.io/api/v2.2/wallets/${walletAddress}/defi/positions?chain=${chain}`;

    console.log("[MORALIS API] Fetching DeFi positions:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "X-API-Key": MORALIS_API_KEY,
      },
    });

    if (!response.ok) {
      console.error("[MORALIS API] Error response:", response.status, response.statusText);
      return NextResponse.json(
        { error: `Failed to fetch positions: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[MORALIS API] Fetched positions:", data.length || 0);

    return NextResponse.json({
      success: true,
      positions: data,
      walletAddress,
      chain,
    });
  } catch (error) {
    console.error("[MORALIS API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
