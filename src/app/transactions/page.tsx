"use client";

import { useAccount } from "wagmi";
import { useInfiniteQuery } from "@tanstack/react-query";
import { WalletConnect } from "@/components/WalletConnect";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { FloatingTransactionsChat } from "@/components/FloatingTransactionsChat";

interface Transaction {
  hash: string;
  nonce: string;
  transaction_index: string;
  from_address: string;
  from_address_label: string | null;
  to_address: string;
  to_address_label: string | null;
  value: string;
  gas: string;
  gas_price: string;
  input: string;
  receipt_cumulative_gas_used: string;
  receipt_gas_used: string;
  receipt_contract_address: string | null;
  receipt_root: string | null;
  receipt_status: string;
  block_timestamp: string;
  block_number: string;
  block_hash: string;
  transfer_index?: number[];
  transaction_fee?: string;
}

const getChainName = (chainId: number) => {
  const chainMap: Record<number, string> = {
    1: "eth",
    56: "bsc",
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
    `/api/transactions?address=${address}&chain=${chainName}&limit=25${cursorParam}`
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

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTransactionType = (tx: Transaction) => {
    if (!address) return "unknown";
    if (tx.from_address.toLowerCase() === address.toLowerCase()) {
      return tx.to_address ? "sent" : "contract-creation";
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
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
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
                <WalletConnect />
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
                                  Amount
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
                                const value = parseFloat(tx.value) / 1e18;

                                return (
                                  <tr
                                    key={index}
                                    className="hover:bg-white/5 transition-colors"
                                  >
                                    {/* Type */}
                                    <td className="px-4 py-4">
                                      <div className="flex items-center gap-2">
                                        <span className="text-lg">{typeInfo.icon}</span>
                                        <span className={`text-sm font-semibold ${typeInfo.color}`}>
                                          {typeInfo.label}
                                        </span>
                                      </div>
                                    </td>

                                    {/* From/To */}
                                    <td className="px-4 py-4">
                                      <div className="text-sm">
                                        <div className="text-gray-400 text-xs mb-0.5">
                                          From
                                        </div>
                                        <div className="text-white font-mono text-xs">
                                          {tx.from_address_label || formatAddress(tx.from_address)}
                                        </div>
                                        <div className="text-gray-400 text-xs mt-1 mb-0.5">
                                          To
                                        </div>
                                        <div className="text-white font-mono text-xs">
                                          {tx.to_address
                                            ? tx.to_address_label || formatAddress(tx.to_address)
                                            : "Contract"}
                                        </div>
                                      </div>
                                    </td>

                                    {/* Amount */}
                                    <td className="px-4 py-4">
                                      {value > 0 ? (
                                        <div className={`text-sm font-semibold ${typeInfo.color}`}>
                                          {formatValue(tx.value)} ETH
                                        </div>
                                      ) : (
                                        <span className="text-xs text-gray-500">
                                          Contract Call
                                        </span>
                                      )}
                                    </td>

                                    {/* Status */}
                                    <td className="px-4 py-4">
                                      <span
                                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                                          tx.receipt_status === "1"
                                            ? "text-emerald-400"
                                            : "text-red-400"
                                        }`}
                                      >
                                        {tx.receipt_status === "1" ? "✓" : "✗"}
                                        {tx.receipt_status === "1" ? "Success" : "Failed"}
                                      </span>
                                    </td>

                                    {/* Date */}
                                    <td className="px-4 py-4">
                                      <div className="text-xs text-gray-400">
                                        {formatDate(tx.block_timestamp)}
                                      </div>
                                    </td>

                                    {/* Action */}
                                    <td className="px-4 py-4">
                                      <a
                                        href={`https://etherscan.io/tx/${tx.hash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary-400 hover:text-primary-300"
                                      >
                                        View →
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
