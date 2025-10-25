import { NextRequest, NextResponse } from "next/server";
import { fetchTransactionHistory } from "@/lib/zapper-client";
import type { TransactionHistoryV2Response } from "@/types/zapper";
import { isTimelineEventV2, isActivityTimelineEventDelta } from "@/types/zapper";

export const dynamic = "force-dynamic";

/**
 * Chain name to chain ID mapping
 */
const CHAIN_NAME_TO_ID: Record<string, number> = {
  eth: 1,
  ethereum: 1,
  polygon: 137,
  optimism: 10,
  arbitrum: 42161,
  base: 8453,
  avalanche: 43114,
  bsc: 56,
  fantom: 250,
};

/**
 * GET /api/transactions
 *
 * Fetches transaction history using Zapper API
 *
 * Query Parameters:
 * - address: Wallet address (required)
 * - chain: Chain name (optional, defaults to eth)
 * - chainId: Chain ID (optional, overrides chain)
 * - limit: Number of transactions to fetch (optional, default 25)
 * - cursor: Pagination cursor (optional)
 * - perspective: Transaction perspective - Signer, Receiver, or All (optional, default Signer)
 *
 * Returns:
 * - Transaction history with human-readable descriptions
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const walletAddress = searchParams.get("address");
    const chain = searchParams.get("chain") || "eth";
    const chainIdParam = searchParams.get("chainId");
    const requestedLimit = parseInt(searchParams.get("limit") || "20");
    // Zapper API has a maximum of 20 items per request
    const limit = Math.min(requestedLimit, 20);
    const cursor = searchParams.get("cursor");
    const perspectiveParam = searchParams.get("perspective") || "Signer";

    if (!walletAddress) {
      return NextResponse.json(
        {
          success: false,
          error: "Wallet address is required",
          userMessage: "Please provide a wallet address to fetch transactions.",
        },
        { status: 400 }
      );
    }

    // Determine chain ID
    let chainId: number | undefined;
    if (chainIdParam) {
      chainId = parseInt(chainIdParam);
    } else if (chain) {
      chainId = CHAIN_NAME_TO_ID[chain.toLowerCase()];
    }

    // Validate perspective
    const perspective = ["Signer", "Receiver", "All"].includes(perspectiveParam)
      ? (perspectiveParam as "Signer" | "Receiver" | "All")
      : "Signer";

    console.log("[ZAPPER API] Fetching transactions for:", walletAddress, "chainId:", chainId);

    // Build filters
    const filters: { chainIds?: number[] } = chainId ? { chainIds: [chainId] } : {};

    // Only add orderByDirection if we have date filters
    // Zapper requires startDate or endDate when using orderByDirection
    // For now, we omit it to avoid errors - results will be in default order

    // Fetch transactions from Zapper
    const data = await fetchTransactionHistory(
      [walletAddress],
      perspective,
      limit,
      cursor || undefined,
      Object.keys(filters).length > 0 ? filters : undefined
    ) as TransactionHistoryV2Response;

    if (!data || !data.transactionHistoryV2) {
      return NextResponse.json(
        {
          success: false,
          error: "No transaction data returned from Zapper API",
          userMessage: "Unable to fetch transactions. Please try again.",
        },
        { status: 500 }
      );
    }

    const history = data.transactionHistoryV2;

    // Transform transactions to a more consumable format
    const transactions = history.edges.map(({ node }) => {
      if (isTimelineEventV2(node)) {
        return {
          hash: node.hash,
          network: node.network,
          timestamp: node.timestamp,
          from: node.fromAddress.address,
          fromLabel: node.fromAddress.displayName?.value || null,
          to: node.toAddress?.address || null,
          toLabel: node.toAddress?.displayName?.value || null,
          value: node.value,
          description: node.interpretation.processedDescription,
          tokenDeltas: node.perspectiveDelta?.tokenDeltasV2.edges.map(({ node: delta }) => ({
            address: delta.address,
            amount: delta.amount,
            amountRaw: delta.amountRaw,
            token: delta.token,
          })) || [],
          type: "timeline",
        };
      } else if (isActivityTimelineEventDelta(node)) {
        return {
          hash: node.transactionHash,
          network: node.network,
          timestamp: node.transactionBlockTimestamp,
          from: node.from.address,
          fromLabel: node.from.displayName?.value || null,
          to: node.to?.address || null,
          toLabel: node.to?.displayName?.value || null,
          description: null,
          fungibleDeltas: node.fungibleDeltas.map((delta) => ({
            address: delta.address,
            amount: delta.amount,
            amountRaw: delta.amountRaw,
            token: delta.token,
          })),
          type: "delta",
        };
      }
      return null;
    }).filter(Boolean);

    console.log(
      "[ZAPPER API] Fetched transactions:",
      transactions.length,
      "Has next page:",
      history.pageInfo.hasNextPage
    );

    return NextResponse.json({
      success: true,
      message: "Transactions fetched successfully",
      transactions,
      cursor: history.pageInfo.endCursor || null,
      hasNextPage: history.pageInfo.hasNextPage,
      totalCount: history.totalCount,
      walletAddress,
      chainId,
    });
  } catch (error) {
    console.error("[ZAPPER API] Error fetching transactions:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        userMessage:
          "Failed to fetch transactions. Please check your API key and try again.",
      },
      { status: 500 }
    );
  }
}
