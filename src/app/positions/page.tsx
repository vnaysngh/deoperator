"use client";

import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { WalletConnect } from "@/components/WalletConnect";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { FloatingPositionsChat } from "@/components/FloatingPositionsChat";

interface Token {
  token_type: string;
  name: string;
  symbol: string;
  contract_address: string;
  decimals: string;
  logo?: string;
  thumbnail?: string;
  balance: string;
  balance_formatted: string;
  usd_price?: number | null;
  usd_value?: number | null;
}

interface Position {
  protocol_name: string;
  protocol_id: string;
  protocol_url: string;
  protocol_logo: string;
  position: {
    label: string;
    tokens: Token[];
    address: string;
    balance_usd: number | null;
    total_unclaimed_usd_value: number | null;
    position_details?: Record<string, unknown>;
  };
}

const getChainName = (chainId: number) => {
  const chainMap: Record<number, string> = {
    1: "eth",
    137: "polygon",
    56: "bsc",
    43114: "avalanche",
    250: "fantom",
    42161: "arbitrum",
    10: "optimism",
  };
  return chainMap[chainId] || "eth";
};

const fetchPositions = async (address: string, chainId: number) => {
  const chainName = getChainName(chainId);
  console.log("[POSITIONS] Fetching positions for:", address, "chain:", chainName);

  const response = await fetch(
    `/api/defi-positions?address=${address}&chain=${chainName}`
  );

  console.log("[POSITIONS] Response status:", response.status);

  if (!response.ok) {
    const errorData = await response.json();
    console.error("[POSITIONS] Error response:", errorData);
    throw new Error(errorData.error || "Failed to fetch positions");
  }

  const data = await response.json();
  console.log("[POSITIONS] Fetched data:", data);
  return data.positions || [];
};

export default function PositionsPage() {
  const { chain } = useAccount();

  // Hardcoded address for demo
  const DEMO_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

  const {
    data: positions = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["positions", DEMO_ADDRESS, chain?.id],
    queryFn: () => fetchPositions(DEMO_ADDRESS, chain!.id),
    enabled: !!chain,
    staleTime: 2 * 60 * 1000, // 2 minutes - positions don't change frequently
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  const getPositionIcon = (label: string) => {
    switch (label.toLowerCase()) {
      case "liquidity":
        return "💧";
      case "staking":
        return "🔒";
      case "supplied":
        return "💰";
      default:
        return "📊";
    }
  };

  const getProtocolColor = (protocolId: string) => {
    const colors: Record<string, string> = {
      "uniswap-v2": "from-pink-500/20 to-purple-500/20 border-pink-500/30",
      "uniswap-v3": "from-pink-500/20 to-purple-500/20 border-pink-500/30",
      lido: "from-blue-500/20 to-cyan-500/20 border-blue-500/30",
      "aave-v2": "from-purple-500/20 to-indigo-500/20 border-purple-500/30",
      "aave-v3": "from-purple-500/20 to-indigo-500/20 border-purple-500/30",
    };
    return colors[protocolId] || "from-emerald-500/20 to-teal-500/20 border-emerald-500/30";
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="md:pl-[var(--sidebar-width)]">
        <div className="min-h-screen">
          <header className="border-b border-white/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold gradient-text">
                    DeFi Positions
                  </h1>
                  <p className="text-sm text-gray-400 mt-1">
                    Track and understand your DeFi portfolio
                  </p>
                </div>
                <WalletConnect />
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-48">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading your positions...</p>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-20">
                <div className="glass-strong rounded-xl p-6 max-w-md mx-auto border border-red-500/30">
                  <div className="text-red-400 mb-4">
                    ⚠️ {error instanceof Error ? error.message : "Failed to fetch positions"}
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
                  {positions.length === 0 ? (
                    <div className="text-center py-12 glass-strong rounded-xl">
                      <div className="text-6xl mb-4">🌾</div>
                      <h3 className="text-xl font-semibold text-white mb-2">
                        No Positions Found
                      </h3>
                      <p className="text-gray-400">
                        Start farming, staking, or providing liquidity to see
                        your positions here
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Summary Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        <div className="glass-strong rounded-xl p-4 border border-white/10">
                          <div className="text-xs text-gray-400 mb-1">
                            Total Positions
                          </div>
                          <div className="text-2xl font-bold text-white">
                            {positions.length}
                          </div>
                        </div>
                        <div className="glass-strong rounded-xl p-4 border border-white/10">
                          <div className="text-xs text-gray-400 mb-1">
                            Protocols
                          </div>
                          <div className="text-2xl font-bold text-white">
                            {
                              new Set(positions.map((p) => p.protocol_id))
                                .size
                            }
                          </div>
                        </div>
                        <div className="glass-strong rounded-xl p-4 border border-white/10">
                          <div className="text-xs text-gray-400 mb-1">
                            Total Value
                          </div>
                          <div className="text-2xl font-bold text-emerald-400">
                            $
                            {positions
                              .reduce(
                                (sum, p) =>
                                  sum + (p.position.balance_usd || 0),
                                0
                              )
                              .toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                          </div>
                        </div>
                      </div>

                      {/* Positions Table */}
                      <div className="glass-strong rounded-xl overflow-hidden border border-white/10">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="border-b border-white/10">
                              <tr className="text-left">
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                                  Protocol
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                                  Type
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                                  Assets
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                                  Value
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                                  Action
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {positions.map((position, index) => (
                                <tr
                                  key={index}
                                  className="hover:bg-white/5 transition-colors"
                                >
                                  {/* Protocol */}
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-3">
                                      {position.protocol_logo ? (
                                        <img
                                          src={position.protocol_logo}
                                          alt={position.protocol_name}
                                          className="w-8 h-8 rounded-lg"
                                          onError={(e) => {
                                            e.currentTarget.style.display = "none";
                                          }}
                                        />
                                      ) : (
                                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-lg">
                                          {getPositionIcon(position.position.label)}
                                        </div>
                                      )}
                                      <div>
                                        <div className="text-sm font-semibold text-white">
                                          {position.protocol_name}
                                        </div>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Type */}
                                  <td className="px-4 py-4">
                                    <span className="text-xs px-2 py-1 rounded-md glass text-gray-300 capitalize">
                                      {position.position.label}
                                    </span>
                                  </td>

                                  {/* Assets */}
                                  <td className="px-4 py-4">
                                    <div className="flex flex-col gap-1">
                                      {position.position.tokens
                                        .filter((t) => t.token_type !== "defi-token")
                                        .slice(0, 2)
                                        .map((token, tidx) => (
                                          <div key={tidx} className="flex items-center gap-2">
                                            {token.logo && (
                                              <img
                                                src={token.logo}
                                                alt={token.symbol}
                                                className="w-4 h-4 rounded-full"
                                                onError={(e) => {
                                                  e.currentTarget.style.display = "none";
                                                }}
                                              />
                                            )}
                                            <span className="text-sm text-white">
                                              {parseFloat(token.balance_formatted).toLocaleString(undefined, {
                                                maximumFractionDigits: 4,
                                              })}{" "}
                                              {token.symbol}
                                            </span>
                                          </div>
                                        ))}
                                      {position.position.tokens.filter((t) => t.token_type !== "defi-token").length > 2 && (
                                        <span className="text-xs text-gray-500">
                                          +{position.position.tokens.filter((t) => t.token_type !== "defi-token").length - 2} more
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Value */}
                                  <td className="px-4 py-4">
                                    {position.position.balance_usd !== null ? (
                                      <div className="text-sm font-semibold text-emerald-400">
                                        $
                                        {position.position.balance_usd.toLocaleString(undefined, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-500">N/A</span>
                                    )}
                                  </td>

                                  {/* Action */}
                                  <td className="px-4 py-4">
                                    <a
                                      href={position.protocol_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary-400 hover:text-primary-300"
                                    >
                                      Open →
                                    </a>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
              </div>
            )}
          </main>

          {/* Floating Chat */}
          <FloatingPositionsChat
            positions={positions}
            walletAddress={DEMO_ADDRESS}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
