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
  megaeth: 6342,
};

/**
 * Blockscout Transaction Response Type
 */
interface BlockscoutTransaction {
  hash: string;
  nonce: number;
  from: {
    hash: string;
    name?: string | null;
  };
  to: {
    hash: string;
    name?: string | null;
  } | null;
  value: string;
  gas_used: string;
  gas_limit: string;
  gas_price: string;
  fee: {
    type: string;
    value: string;
  };
  status: string;
  timestamp: string;
  block_number: number;
  method?: string | null;
  result?: string;
}

interface BlockscoutResponse {
  items: BlockscoutTransaction[];
  next_page_params: {
    block_number: number;
    index: number;
  } | null;
}

/**
 * Normalized transaction format matching Zapper's structure
 */
interface NormalizedTransaction {
  hash: string;
  network: string;
  timestamp: number;
  from: string;
  fromLabel: string | null;
  to: string | null;
  toLabel: string | null;
  value: string;
  description: string | null;
  tokenDeltas: never[];
  fungibleDeltas: never[];
  type: string;
}

/**
 * Fetch transactions from Blockscout API for MegaETH testnet
 */
async function fetchBlockscoutTransactions(
  address: string,
  cursor?: string
): Promise<{ transactions: NormalizedTransaction[]; cursor: string | null; hasNextPage: boolean }> {
  try {
    let url = `https://megaeth-testnet.blockscout.com/api/v2/addresses/${address}/transactions`;

    // Add pagination params if cursor exists
    if (cursor) {
      const cursorData = JSON.parse(cursor);
      url += `?block_number=${cursorData.block_number}&index=${cursorData.index}`;
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Blockscout API returned ${response.status}`);
    }

    const data: BlockscoutResponse = await response.json();

    // Transform Blockscout transactions to match Zapper format
    const transactions = data.items.map((tx) => ({
      hash: tx.hash,
      network: "MegaETH Testnet",
      timestamp: new Date(tx.timestamp).getTime(), // Convert to milliseconds timestamp
      from: tx.from.hash,
      fromLabel: tx.from.name || null,
      to: tx.to?.hash || null,
      toLabel: tx.to?.name || null,
      value: tx.value,
      description: tx.method || null,
      tokenDeltas: [],
      fungibleDeltas: [],
      type: "timeline",
    }));

    // Prepare next cursor
    const nextCursor = data.next_page_params
      ? JSON.stringify(data.next_page_params)
      : null;

    return {
      transactions,
      cursor: nextCursor,
      hasNextPage: !!data.next_page_params,
    };
  } catch (error) {
    console.error("[BLOCKSCOUT API] Error fetching transactions:", error);
    throw error;
  }
}

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

    console.log("[TRANSACTIONS API] Fetching transactions for:", walletAddress, "chainId:", chainId);

    // Check if this is MegaETH testnet (chain ID 6342)
    if (chainId === 6342) {
      console.log("[TRANSACTIONS API] Using Blockscout API for MegaETH testnet");

      try {
        const result = await fetchBlockscoutTransactions(walletAddress, cursor || undefined);

        return NextResponse.json({
          success: true,
          message: "Transactions fetched successfully from Blockscout",
          transactions: result.transactions,
          cursor: result.cursor,
          hasNextPage: result.hasNextPage,
          totalCount: result.transactions.length,
          walletAddress,
          chainId,
        });
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            userMessage: "Failed to fetch MegaETH transactions. Please try again.",
          },
          { status: 500 }
        );
      }
    }

    // Use Zapper API for other chains
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
