"use client";

import { useAccount } from "wagmi";
import { useInfiniteQuery } from "@tanstack/react-query";
import { WalletConnect } from "@/components/WalletConnect";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { FloatingTransactionsChat } from "@/components/FloatingTransactionsChat";

// Zapper API Transaction Format
interface Transaction {
  hash: string;
  network: string;
  timestamp: number;
  from: string;
  fromLabel: string | null;
  to: string | null;
  toLabel: string | null;
  value?: string;
  description?: string | null;
  tokenDeltas?: Array<{
    address: string;
    amount: number;
    amountRaw: string;
    token: {
      address: string;
      name: string;
      symbol: string;
      decimals: number;
      imageUrlV2?: string | null;
    };
  }>;
  fungibleDeltas?: Array<{
    address: string;
    amount: number;
    amountRaw: string;
    token: {
      address: string;
      name: string;
      symbol: string;
      decimals: number;
      imageUrlV2?: string | null;
    };
  }>;
  type: "timeline" | "delta";
}

const getChainName = (chainId: number) => {
  const chainMap: Record<number, string> = {
    1: "eth",
    43114: "avalanche",
    250: "fantom",
    42161: "arbitrum",
    10: "optimism",
  };
  return chainMap[chainId] || "eth";
};


const fetchTransactions = async (
  address: string,
  chainId: number,
  cursor?: string
) => {
  const chainName = getChainName(chainId);
  const cursorParam = cursor ? `&cursor=${cursor}` : "";
  console.log("[TRANSACTIONS] Fetching transactions for:", address, "chain:", chainName);

  const response = await fetch(
    `/api/transactions?address=${address}&chain=${chainName}&limit=20${cursorParam}`
  );

  console.log("[TRANSACTIONS] Response status:", response.status);

  if (!response.ok) {
    const errorData = await response.json();
    console.error("[TRANSACTIONS] Error response:", errorData);
    throw new Error(errorData.error || "Failed to fetch transactions");
  }

  const data = await response.json();
  console.log("[TRANSACTIONS] Fetched data:", data);
  return {
    transactions: data.transactions || [],
    nextCursor: data.cursor || undefined,
  };
};

export default function TransactionsPage() {
  const { address, chain } = useAccount();

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["transactions", address, chain?.id],
    queryFn: ({ pageParam }) =>
      fetchTransactions(address!, chain!.id, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!address && !!chain,
    staleTime: 30 * 1000, // 30 seconds - transactions update frequently
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    initialPageParam: undefined,
  });

  // Flatten all pages into single array
  const transactions = data?.pages.flatMap((page) => page.transactions) || [];
  const loading = isLoading && transactions.length === 0;

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatValue = (value: string) => {
    const ethValue = parseFloat(value) / 1e18;
    return ethValue.toFixed(6);
  };

  const formatDate = (timestamp: number) => {
    // Zapper returns timestamp in milliseconds (not seconds)
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getTransactionType = (tx: Transaction) => {
    if (!address) return "unknown";
    if (tx.from.toLowerCase() === address.toLowerCase()) {
      return tx.to ? "sent" : "contract-creation";
    }
    return "received";
  };

  const getTransactionTypeInfo = (type: string) => {
    switch (type) {
      case "sent":
        return { label: "Sent", icon: "↗", color: "text-red-400" };
      case "received":
        return { label: "Received", icon: "↙", color: "text-emerald-400" };
      case "contract-creation":
        return { label: "Contract", icon: "📄", color: "text-blue-400" };
      default:
        return { label: "Unknown", icon: "?", color: "text-gray-400" };
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="md:pl-[var(--sidebar-width)]">
        <div className="min-h-screen">
          <header className="border-b border-white/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <SidebarTrigger className="md:hidden" />
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold gradient-text">
                      Transaction History
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1">
                      Review and understand your on-chain activity
                    </p>
                  </div>
                </div>
                <div className="sm:flex sm:items-center sm:justify-end">
                  <WalletConnect />
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-48">
            {!address ? (
              <div className="text-center py-20">
                <div className="glass-strong rounded-xl p-8 max-w-md mx-auto border border-primary-500/30">
                  <div className="text-6xl mb-4">🔐</div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Connect Your Wallet
                  </h3>
                  <p className="text-gray-400 mb-6">
                    Connect your wallet to view your transaction history
                  </p>
                  <WalletConnect />
                </div>
              </div>
            ) : loading && transactions.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading your transactions...</p>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-20">
                <div className="glass-strong rounded-xl p-6 max-w-md mx-auto border border-red-500/30">
                  <div className="text-red-400 mb-4">
                    ⚠️ {error instanceof Error ? error.message : "Failed to fetch transactions"}
                  </div>
                  <button
                    onClick={() => refetch()}
                    className="px-6 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-semibold"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                  {transactions.length === 0 ? (
                    <div className="text-center py-12 glass-strong rounded-xl">
                      <div className="text-6xl mb-4">📭</div>
                      <h3 className="text-xl font-semibold text-white mb-2">
                        No Transactions Found
                      </h3>
                      <p className="text-gray-400">
                        Your transaction history will appear here once you make
                        your first transaction
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Transactions Table */}
                      <div className="glass-strong rounded-xl overflow-hidden border border-white/10">
                        <div className="overflow-x-auto -mx-4 sm:mx-0">
                          <div className="inline-block min-w-full align-middle">
                            <table className="min-w-full w-full">
                            <thead className="border-b border-white/10">
                              <tr className="text-left">
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                                  Type
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                                  From/To
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                                  Details
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                                  Status
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                                  Date
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                                  Action
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {transactions.map((tx, index) => {
                                const type = getTransactionType(tx);
                                const typeInfo = getTransactionTypeInfo(type);
                                const value = tx.value ? parseFloat(tx.value) / 1e18 : 0;

                                // Get token deltas for display
                                const deltas = tx.tokenDeltas || tx.fungibleDeltas || [];
                                const hasDescription = tx.description && tx.description.trim();

                                return (
                                  <tr
                                    key={`${tx.hash}-${index}`}
                                    className="hover:bg-white/5 transition-colors"
                                  >
                                    {/* Type */}
                                    <td className="px-4 py-4">
                                      <span className={`text-sm font-semibold ${typeInfo.color}`}>
                                        {typeInfo.icon} {typeInfo.label}
                                      </span>
                                    </td>

                                    {/* From/To with Avatars */}
                                    <td className="px-4 py-4">
                                      <div className="text-sm space-y-2">
                                        <div className="flex items-center gap-2">
                                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-[10px]">
                                            {tx.fromLabel ? tx.fromLabel.slice(0, 2).toUpperCase() : "?"}
                                          </div>
                                          <div>
                                            <div className="text-gray-400 text-[10px]">From</div>
                                            <div className="text-white font-mono text-xs">
                                              {tx.fromLabel || formatAddress(tx.from)}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center text-[10px]">
                                            {tx.toLabel ? tx.toLabel.slice(0, 2).toUpperCase() : tx.to ? "?" : "📄"}
                                          </div>
                                          <div>
                                            <div className="text-gray-400 text-[10px]">To</div>
                                            <div className="text-white font-mono text-xs">
                                              {tx.to ? (tx.toLabel || formatAddress(tx.to)) : "Contract"}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </td>

                                    {/* Details with Token Logos */}
                                    <td className="px-4 py-4">
                                      {hasDescription ? (
                                        <div className="flex items-start gap-2">
                                          {deltas.length > 0 && deltas[0].token.imageUrlV2 ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                              src={deltas[0].token.imageUrlV2}
                                              alt={deltas[0].token.symbol}
                                              className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5"
                                              onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = "none";
                                              }}
                                            />
                                          ) : null}
                                          <div className="text-xs text-gray-300 max-w-xs">
                                            {tx.description}
                                          </div>
                                        </div>
                                      ) : value > 0 ? (
                                        <div className="flex items-center gap-2">
                                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
                                            Ξ
                                          </div>
                                          <div className={`text-sm font-semibold ${typeInfo.color}`}>
                                            {formatValue(tx.value!)} ETH
                                          </div>
                                        </div>
                                      ) : deltas.length > 0 ? (
                                        <div className="flex items-center gap-2">
                                          {deltas[0].token.imageUrlV2 ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                              src={deltas[0].token.imageUrlV2}
                                              alt={deltas[0].token.symbol}
                                              className="w-5 h-5 rounded-full"
                                              onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = "none";
                                              }}
                                            />
                                          ) : (
                                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-[9px] font-bold">
                                              {deltas[0].token.symbol.slice(0, 2)}
                                            </div>
                                          )}
                                          <div className="text-xs text-gray-300">
                                            {deltas[0].token.symbol}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-gray-500">
                                          Contract Call
                                        </span>
                                      )}
                                    </td>

                                    {/* Status - Zapper only returns successful txs */}
                                    <td className="px-4 py-4">
                                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-xs font-medium text-emerald-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                        Success
                                      </span>
                                    </td>

                                    {/* Date */}
                                    <td className="px-4 py-4">
                                      <div className="text-xs text-gray-400">
                                        {formatDate(tx.timestamp)}
                                      </div>
                                    </td>

                                    {/* Action */}
                                    <td className="px-4 py-4">
                                      <a
                                        href={`https://etherscan.io/tx/${tx.hash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
                                      >
                                        View
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                      </a>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          </div>
                        </div>
                      </div>

                      {/* Load More Button */}
                      {hasNextPage && (
                        <div className="flex justify-center pt-4">
                          <button
                            onClick={() => fetchNextPage()}
                            disabled={isFetchingNextPage}
                            className="px-6 py-3 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-all"
                          >
                            {isFetchingNextPage ? "Loading..." : "Load More"}
                          </button>
                        </div>
                      )}
                    </>
                  )}
              </div>
            )}
          </main>

          {/* Floating Chat */}
          <FloatingTransactionsChat
            transactions={transactions}
            walletAddress={address}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
