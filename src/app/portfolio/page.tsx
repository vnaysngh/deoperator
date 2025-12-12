"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { WalletConnect } from "@/components/WalletConnect";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger
} from "@/components/ui/sidebar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { ChevronRight } from "lucide-react";
import type {
  PortfolioSummary,
  NetworkSummary,
  MegaETHPortfolioItem
} from "@/types/zapper";

interface PortfolioResponse {
  success: boolean;
  message?: string;
  address: string;
  summary: PortfolioSummary;
}

interface MegaETHPortfolioResponse {
  success: boolean;
  message?: string;
  address: string;
  tokens: MegaETHPortfolioItem[];
  totalTokens: number;
}

const fetchPortfolio = async (address: string) => {
  const response = await fetch(`/api/portfolio?address=${address}`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.userMessage || "Failed to fetch portfolio");
  }

  return response.json() as Promise<PortfolioResponse>;
};

const fetchMegaETHPortfolio = async (address: string) => {
  const response = await fetch(`/api/megaeth-portfolio?address=${address}`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.userMessage || "Failed to fetch MegaETH portfolio"
    );
  }

  return response.json() as Promise<MegaETHPortfolioResponse>;
};

const formatUSD = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

const formatTokenAmount = (amount: number, decimals?: number) => {
  if (amount === 0) return "0";
  if (amount < 0.0001) return "<0.0001";

  const d = decimals !== undefined ? Math.min(decimals, 6) : 6;
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: d
  });
};

const formatNetworkName = (networkName: string): string => {
  return networkName
    .replace(" MAINNET", "")
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => {
      // Special case for MegaETH
      if (word.toUpperCase() === "MEGAETH") {
        return "MegaETH";
      }
      return word.charAt(0) + word.slice(1).toLowerCase();
    })
    .join(" ");
};

export default function PortfolioPage() {
  const { address } = useAccount();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkSummary | null>(
    null
  );

  const {
    data: portfolioData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ["portfolio", address],
    queryFn: () => fetchPortfolio(address!),
    enabled: !!address,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000 // Keep in cache for 5 minutes
  });

  const {
    data: megaETHData,
    isLoading: megaETHLoading
  } = useQuery({
    queryKey: ["megaeth-portfolio", address],
    queryFn: () => fetchMegaETHPortfolio(address!),
    enabled: !!address,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000 // Keep in cache for 5 minutes
  });

  const summary = portfolioData?.summary;

  console.log(portfolioData, "portfolio data");
  console.log(megaETHData, "megaeth data");

  // Create MegaETH network summary if we have data
  const megaETHNetworkSummary: NetworkSummary | null = megaETHData
    ? {
        chainId: 11011, // MegaETH testnet chain ID
        name: "MEGAETH TESTNET",
        slug: "megaeth-testnet",
        tokenBalanceUSD: 0, // No USD values from testnet
        appBalanceUSD: 0,
        totalBalanceUSD: 0,
        tokenCount: megaETHData.totalTokens,
        appCount: 0
      }
    : null;

  // Combine networks with MegaETH
  const allNetworks = [
    ...(megaETHNetworkSummary ? [megaETHNetworkSummary] : []),
    ...(summary?.networkSummaries || [])
  ];

  // Reset drawer when address changes
  useEffect(() => {
    setDrawerOpen(false);
    setSelectedNetwork(null);
  }, [address]);

  // Check if selected network is MegaETH
  const isMegaETHSelected = selectedNetwork?.chainId === 11011;

  // Get tokens and apps for selected network
  const selectedNetworkTokens = selectedNetwork
    ? isMegaETHSelected
      ? [] // MegaETH tokens handled separately
      : summary?.topTokens.filter(
          (t) => t.network.chainId === selectedNetwork.chainId
        ) || []
    : [];

  const selectedNetworkApps = selectedNetwork
    ? isMegaETHSelected
      ? []
      : summary?.topApps.filter(
          (a) => a.network.chainId === selectedNetwork.chainId
        ) || []
    : [];

  // Get MegaETH tokens if selected
  const megaETHTokens = isMegaETHSelected ? megaETHData?.tokens || [] : [];

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
                      Portfolio
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1">
                      Your multi-chain portfolio overview
                    </p>
                  </div>
                </div>
                <div className="sm:flex sm:items-center sm:justify-end">
                  <WalletConnect />
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            {!address ? (
              <div className="text-center py-20">
                <div className="glass-strong rounded-xl p-8 max-w-md mx-auto border border-primary-500/30">
                  <div className="text-6xl mb-4">💼</div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Connect Your Wallet
                  </h3>
                  <p className="text-gray-400 mb-6">
                    Connect your wallet to view your portfolio
                  </p>
                  <WalletConnect />
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading your portfolio...</p>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-20">
                <div className="glass-strong rounded-xl p-6 max-w-md mx-auto border border-red-500/30">
                  <div className="text-red-400 mb-4">
                    ⚠️{" "}
                    {error instanceof Error
                      ? error.message
                      : "Failed to fetch portfolio"}
                  </div>
                  <button
                    onClick={() => refetch()}
                    className="px-6 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-semibold"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : summary ? (
              <>
                {/* Portfolio Overview */}
                <div className="glass-strong rounded-xl p-4 sm:p-5 border border-white/10">
                  <div>
                    <h2 className="text-sm font-semibold text-white uppercase tracking-[0.32em]">
                      Portfolio Overview
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Total value across all chains
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-gray-400 text-sm mb-1">
                        Total Balance
                      </div>
                      <div className="text-2xl font-bold gradient-text">
                        {formatUSD(summary.totalBalanceUSD)}
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-gray-400 text-sm mb-1">
                        Wallet Balance
                      </div>
                      <div className="text-2xl font-bold text-emerald-400">
                        {formatUSD(summary.tokenBalanceUSD)}
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-gray-400 text-sm mb-1">
                        DeFi Positions
                      </div>
                      <div className="text-2xl font-bold text-blue-400">
                        {formatUSD(summary.appBalanceUSD)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Networks Table */}
                <div className="glass-strong border border-white/10 rounded-xl overflow-hidden">
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-white/5">
                        <tr className="text-left text-xs uppercase tracking-[0.22em] text-gray-400">
                          <th className="px-4 py-3 font-medium">Network</th>
                          <th className="px-4 py-3 font-medium">
                            Total Balance
                          </th>
                          {/* <th className="px-4 py-3 font-medium">Tokens</th> */}
                          <th className="px-4 py-3 font-medium">DeFi</th>
                          <th className="px-4 py-3 font-medium">Tokens</th>
                          <th className="px-4 py-3 font-medium w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoading || megaETHLoading ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-4 py-8 text-center text-gray-400"
                            >
                              <div className="flex items-center justify-center gap-3">
                                <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                                <span>Loading portfolio...</span>
                              </div>
                            </td>
                          </tr>
                        ) : allNetworks.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-4 py-12 text-center text-gray-400"
                            >
                              No networks with balances found
                            </td>
                          </tr>
                        ) : (
                          allNetworks.map((network) => (
                            <tr
                              key={network.chainId}
                              className="group border-t border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                              onClick={() => {
                                setSelectedNetwork(network);
                                setDrawerOpen(true);
                              }}
                            >
                              <td className="px-4 py-4 align-top">
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-medium text-white">
                                    {formatNetworkName(network.name)}
                                  </div>
                                  {network.chainId === 11011 && (
                                    <span className="px-2 py-0.5 bg-primary-500/20 border border-primary-500/30 rounded text-[10px] font-medium text-primary-400">
                                      TESTNET
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Chain ID: {network.chainId}
                                </div>
                              </td>
                              <td className="px-4 py-4 align-top text-gray-200">
                                {network.chainId === 11011
                                  ? "—"
                                  : formatUSD(network.totalBalanceUSD)}
                              </td>
                              {/*   <td className="px-4 py-4 align-top text-gray-200">
                                {network.chainId === 11011
                                  ? "—"
                                  : formatUSD(network.tokenBalanceUSD)}
                              </td> */}
                              <td className="px-4 py-4 align-top text-gray-200">
                                {network.chainId === 11011
                                  ? "—"
                                  : formatUSD(network.appBalanceUSD)}
                              </td>
                              <td className="px-4 py-4 align-top text-gray-300">
                                {network.tokenCount + network.appCount}
                              </td>
                              <td className="px-4 py-4 align-top">
                                <ChevronRight className="h-4 w-4 text-gray-500 group-hover:text-primary-400 transition-all group-hover:translate-x-1" />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden">
                    {isLoading || megaETHLoading ? (
                      <div className="px-4 py-8 text-center text-gray-400">
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                          <span>Loading portfolio...</span>
                        </div>
                      </div>
                    ) : allNetworks.length === 0 ? (
                      <div className="px-4 py-12 text-center text-gray-400">
                        No networks with balances found
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {allNetworks.map((network) => (
                          <div
                            key={network.chainId}
                            className="group p-4 hover:bg-white/5 transition-colors cursor-pointer"
                            onClick={() => {
                              setSelectedNetwork(network);
                              setDrawerOpen(true);
                            }}
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <div className="text-sm font-medium text-white leading-snug">
                                      {formatNetworkName(network.name)}
                                    </div>
                                    {network.chainId === 11011 && (
                                      <span className="px-2 py-0.5 bg-primary-500/20 border border-primary-500/30 rounded text-[10px] font-medium text-primary-400">
                                        TESTNET
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    Chain ID: {network.chainId}
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-gray-500 group-hover:text-primary-400 transition-all group-hover:translate-x-1 flex-shrink-0 mt-1" />
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                  <div className="text-gray-500 uppercase tracking-wider text-[10px]">
                                    Total Balance
                                  </div>
                                  <div className="text-gray-200 font-medium mt-1">
                                    {network.chainId === 11011
                                      ? "—"
                                      : formatUSD(network.totalBalanceUSD)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-500 uppercase tracking-wider text-[10px]">
                                    Positions
                                  </div>
                                  <div className="text-gray-200 font-medium mt-1">
                                    {network.tokenCount + network.appCount}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-500 uppercase tracking-wider text-[10px]">
                                    Tokens
                                  </div>
                                  <div className="text-gray-200 font-medium mt-1">
                                    {network.chainId === 11011
                                      ? "—"
                                      : formatUSD(network.tokenBalanceUSD)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-500 uppercase tracking-wider text-[10px]">
                                    DeFi
                                  </div>
                                  <div className="text-gray-200 font-medium mt-1">
                                    {network.chainId === 11011
                                      ? "—"
                                      : formatUSD(network.appBalanceUSD)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </main>
        </div>
      </SidebarInset>

      {/* Right Drawer for Network Details */}
      <Sheet
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) {
            setSelectedNetwork(null);
          }
        }}
      >
        <SheetContent
          side="right"
          className="bg-black/95 border-l border-white/10 w-full sm:max-w-md overflow-y-auto"
        >
          {selectedNetwork && (
            <>
              <SheetHeader className="border-b border-white/10 pb-4">
                <SheetTitle className="text-base sm:text-lg text-white pr-8 leading-snug">
                  {formatNetworkName(selectedNetwork.name)}
                </SheetTitle>
                <SheetDescription className="text-xs text-gray-400 pt-1">
                  Chain ID: {selectedNetwork.chainId}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                {/* Network Metrics */}
                <div className="glass border border-white/10 rounded-lg p-3 sm:p-4">
                  <h3 className="text-xs uppercase tracking-[0.22em] text-gray-400">
                    Network Balance
                  </h3>
                  <div className="mt-3 space-y-3 text-xs sm:text-sm text-gray-200">
                    {isMegaETHSelected ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span>Total Tokens</span>
                          <span className="font-medium">
                            {selectedNetwork.tokenCount}
                          </span>
                        </div>
                        <div className="px-3 py-2 bg-primary-500/10 border border-primary-500/30 rounded text-[10px] text-primary-400">
                          ⚠️ Testnet - USD values not available
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span>Total Balance</span>
                          <span className="font-medium">
                            {formatUSD(selectedNetwork.totalBalanceUSD)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Token Balance</span>
                          <span className="font-medium text-emerald-400">
                            {formatUSD(selectedNetwork.tokenBalanceUSD)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>DeFi Positions</span>
                          <span className="font-medium text-blue-400">
                            {formatUSD(selectedNetwork.appBalanceUSD)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Total Positions</span>
                          <span className="font-medium">
                            {selectedNetwork.tokenCount +
                              selectedNetwork.appCount}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Tokens List */}
                {isMegaETHSelected
                  ? megaETHTokens.length > 0 && (
                      <div className="glass border border-white/10 rounded-lg p-3 sm:p-4">
                        <h3 className="text-xs uppercase tracking-[0.22em] text-gray-400 mb-3">
                          Tokens ({megaETHTokens.length})
                        </h3>
                        <div className="space-y-2">
                          {megaETHTokens.map((token, index) => (
                            <div
                              key={`${token.tokenAddress}-${index}`}
                              className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {token.imgUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={token.imgUrl}
                                    alt={token.symbol}
                                    className="w-8 h-8 rounded-full"
                                    onError={(e) => {
                                      (
                                        e.target as HTMLImageElement
                                      ).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-[10px] font-bold">
                                    {token.symbol.slice(0, 2)}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="font-semibold text-white text-xs">
                                      {token.symbol}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-gray-400 truncate">
                                    {formatTokenAmount(
                                      token.balance,
                                      token.decimals
                                    )}{" "}
                                    {token.symbol}
                                  </div>
                                  <div className="text-[10px] text-gray-500 truncate mt-0.5">
                                    {token.name}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  : selectedNetworkTokens.length > 0 && (
                      <div className="glass border border-white/10 rounded-lg p-3 sm:p-4">
                        <h3 className="text-xs uppercase tracking-[0.22em] text-gray-400 mb-3">
                          Tokens ({selectedNetworkTokens.length})
                        </h3>
                        <div className="space-y-2">
                          {selectedNetworkTokens.map((token, index) => (
                            <div
                              key={`${token.tokenAddress}-${index}`}
                              className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {token.imgUrlV2 ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={token.imgUrlV2}
                                    alt={token.symbol}
                                    className="w-8 h-8 rounded-full"
                                    onError={(e) => {
                                      (
                                        e.target as HTMLImageElement
                                      ).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-[10px] font-bold">
                                    {token.symbol.slice(0, 2)}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="font-semibold text-white text-xs">
                                      {token.symbol}
                                    </span>
                                    {token.verified && (
                                      <span className="text-blue-400 text-[10px]">
                                        ✓
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-gray-400 truncate">
                                    {formatTokenAmount(
                                      token.balance,
                                      token.decimals
                                    )}{" "}
                                    {token.symbol}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-white text-xs">
                                  {formatUSD(token.balanceUSD)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                {/* DeFi Positions List */}
                {selectedNetworkApps.length > 0 && (
                  <div className="glass border border-white/10 rounded-lg p-3 sm:p-4">
                    <h3 className="text-xs uppercase tracking-[0.22em] text-gray-400 mb-3">
                      DeFi Positions ({selectedNetworkApps.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedNetworkApps.map((app, index) => (
                        <div
                          key={`${app.appId}-${index}`}
                          className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {app.app.imgUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={app.app.imgUrl}
                                alt={app.app.displayName}
                                className="w-8 h-8 rounded-full"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] font-bold">
                                {app.app.displayName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-white text-xs">
                                {app.app.displayName}
                              </div>
                              <div className="text-[10px] text-gray-400">
                                {app.positionCount} position
                                {app.positionCount !== 1 ? "s" : ""}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-white text-xs">
                              {formatUSD(app.balanceUSD)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {(isMegaETHSelected
                  ? megaETHTokens.length === 0
                  : selectedNetworkTokens.length === 0 &&
                    selectedNetworkApps.length === 0) && (
                  <div className="text-center py-8 glass border border-white/10 rounded-lg">
                    <div className="text-4xl mb-2">🔍</div>
                    <p className="text-xs text-gray-400">
                      No assets found on this network
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}
