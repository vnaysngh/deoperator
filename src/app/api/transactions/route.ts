import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MORALIS_API_KEY = process.env.MORALIS_API_KEY as string;

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const walletAddress = searchParams.get("address");
    const chain = searchParams.get("chain") || "eth";
    const order = searchParams.get("order") || "DESC";
    const limit = searchParams.get("limit") || "25";
    const cursor = searchParams.get("cursor");

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    const cursorParam = cursor ? `&cursor=${cursor}` : "";
    const url = `https://deep-index.moralis.io/api/v2.2/${walletAddress}?chain=${chain}&order=${order}&limit=${limit}${cursorParam}`;

    console.log("[MORALIS API] Fetching transactions:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "X-API-Key": MORALIS_API_KEY
      }
    });

    if (!response.ok) {
      console.error(
        "[MORALIS API] Error response:",
        response.status,
        response.statusText
      );
      return NextResponse.json(
        { error: `Failed to fetch transactions: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(
      "[MORALIS API] Fetched transactions:",
      data.result?.length || 0
    );

    return NextResponse.json({
      success: true,
      transactions: data.result || [],
      cursor: data.cursor || null,
      walletAddress,
      chain
    });
  } catch (error) {
    console.error("[MORALIS API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
