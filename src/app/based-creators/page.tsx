"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { WalletConnect } from "@/components/WalletConnect";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import {
  ExternalLink,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  Users
} from "lucide-react";

const PAGE_SIZE = 10; // Show 10 coins per page

type ZoraCoinStatus = "new" | "trending" | "low_liquidity" | "normal";
type QueryType =
  | "new"
  | "trending"
  | "top_volume"
  | "most_valuable"
  | "top_gainers";

type ZoraCoinData = {
  id: string;
  address: string;
  symbol: string;
  name: string;
  description: string;
  imageUrl?: string;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  uniqueHolders: number;
  totalSupply?: string;
  createdAt: string;
  creatorAddress?: string;
  creatorHandle?: string;
  status: ZoraCoinStatus;
  zoraCoinUrl: string;
  zoraCreatorUrl?: string;
  tradingUrl: string;
  explorerUrl: string;
};

const formatCurrency = (value: number): string => {
  if (!value || Number.isNaN(value)) return "$0";

  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
};

const formatPercentage = (value: number): string => {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
};

const formatDate = (dateInput: Date | string): string => {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

const formatRelativeTime = (dateInput: Date | string): string => {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));

  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
};

const StatusChip = ({ status }: { status: ZoraCoinStatus }) => {
  const configs = {
    new: {
      label: "New",
      icon: Sparkles,
      className: "bg-blue-500/15 text-blue-300 border border-blue-500/30"
    },
    trending: {
      label: "Trending 24h",
      icon: TrendingUp,
      className:
        "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
    },
    low_liquidity: {
      label: "Low Liquidity",
      icon: AlertTriangle,
      className: "bg-amber-500/15 text-amber-300 border border-amber-500/30"
    },
    normal: {
      label: "Active",
      icon: null,
      className: "bg-white/10 text-gray-300 border border-white/10"
    }
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${config.className}`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {config.label}
    </span>
  );
};

const SafetyBanner = () => (
  <div className="glass border border-amber-500/30 rounded-xl p-4 mb-6">
    <div className="flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-amber-300">Safety Notice</h3>
        <p className="text-xs text-amber-200/80 mt-1">
          New launches may have low liquidity and higher slippage risk. Always
          verify token contracts and do your own research before trading.
          Trading links redirect to Uniswap.
        </p>
      </div>
    </div>
  </div>
);

export default function BasedCreatorsPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState<ZoraCoinData | null>(null);
  const [queryType, setQueryType] = useState<QueryType>("trending");
  const [minMarketCap, setMinMarketCap] = useState<number | undefined>(
    undefined
  );
  const [new24h, setNew24h] = useState(false);
  const [currentCursor, setCurrentCursor] = useState<string | undefined>(
    undefined
  );
  const [pageHistory, setPageHistory] = useState<string[]>([]);

  const { data, isLoading, isFetching, error, refetch } = useQuery<{
    coins: ZoraCoinData[];
    count: number;
    pagination: {
      hasNextPage: boolean;
      nextCursor?: string;
    };
  }>({
    queryKey: [
      "zora-creator-coins",
      queryType,
      minMarketCap,
      new24h,
      currentCursor
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("type", queryType);
      params.append("limit", PAGE_SIZE.toString());
      if (minMarketCap) params.append("minMarketCap", minMarketCap.toString());
      if (new24h) params.append("new24h", "true");
      if (currentCursor) params.append("cursor", currentCursor);

      const response = await fetch(`/api/zora/creator-coins?${params}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Unable to load creator coins");
      }

      return await response.json();
    },
    refetchInterval: 60_000, // Refetch every minute
    retry: 2,
    staleTime: 30_000, // Consider data stale after 30 seconds
    gcTime: 5 * 60 * 1000 // Keep in cache for 5 minutes
  });

  const coins = useMemo(() => data?.coins ?? [], [data]);
  const hasNextPage = data?.pagination?.hasNextPage ?? false;
  const nextCursor = data?.pagination?.nextCursor;

  const hasNewCoins = useMemo(
    () => coins.some((coin) => coin.status === "new"),
    [coins]
  );

  // Handle next page navigation
  const handleNextPage = () => {
    if (hasNextPage && nextCursor) {
      setPageHistory((prev) => [...prev, currentCursor || ""]);
      setCurrentCursor(nextCursor);
    }
  };

  // Handle previous page navigation
  const handlePrevPage = () => {
    if (pageHistory.length > 0) {
      const previousCursor = pageHistory[pageHistory.length - 1];
      setPageHistory((prev) => prev.slice(0, -1));
      setCurrentCursor(previousCursor || undefined);
    }
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentCursor(undefined);
    setPageHistory([]);
  }, [queryType, minMarketCap, new24h]);

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
                      basedCreators
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1">
                      Discover and track Zora creator coins on Base
                    </p>
                  </div>
                </div>
                <div className="sm:flex sm:items-center sm:justify-end">
                  <WalletConnect />
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 pb-20">
            {hasNewCoins && <SafetyBanner />}

            <section className="space-y-6">
              <div className="glass-strong border border-white/10 rounded-xl p-4 sm:p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white uppercase tracking-[0.32em]">
                      Creator Coins
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Real-time data from Zora.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <label className="flex flex-col gap-1 text-xs text-gray-400">
                      View
                      <select
                        value={queryType}
                        onChange={(e) =>
                          setQueryType(e.target.value as QueryType)
                        }
                        className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                      >
                        <option value="trending">Trending (Volume)</option>
                        <option value="new">New Launches</option>
                        <option value="top_gainers">Top Gainers</option>
                        <option value="most_valuable">Most Valuable</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1 text-xs text-gray-400">
                      Min Market Cap
                      <select
                        value={minMarketCap ?? "all"}
                        onChange={(e) =>
                          setMinMarketCap(
                            e.target.value === "all"
                              ? undefined
                              : Number(e.target.value)
                          )
                        }
                        className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                      >
                        <option value="all">Any Market Cap</option>
                        <option value="10000">$10K+</option>
                        <option value="50000">$50K+</option>
                        <option value="100000">$100K+</option>
                        <option value="500000">$500K+</option>
                      </select>
                    </label>
                  </div>
                </div>

                {/*   <div className="mt-4 flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={new24h}
                      onChange={(e) => setNew24h(e.target.checked)}
                      className="w-4 h-4 rounded border-white/10 bg-black/60 text-emerald-500 focus:ring-emerald-500/50"
                    />
                    Show only coins launched in last 24h
                  </label>
                </div>
 */}
                {isFetching && (
                  <div className="mt-4 inline-flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Syncing with Zora…
                  </div>
                )}

                {error && (
                  <div className="mt-4 flex flex-col gap-3 glass border border-rose-500/20 rounded-lg p-4 text-rose-300">
                    <p className="text-sm font-semibold">
                      Unable to load creator coins
                    </p>
                    <p className="text-xs opacity-90">{error.message}</p>
                    {error.message.includes("Rate limit") && (
                      <div className="text-xs bg-amber-500/10 border border-amber-500/30 rounded p-3 text-amber-200">
                        <strong>💡 Tip:</strong> Add your Zora API key to{" "}
                        <code className="bg-black/30 px-1 py-0.5 rounded">
                          .env.local
                        </code>
                        :
                        <br />
                        <code className="text-[11px]">
                          ZORA_API_KEY=your_key_here
                        </code>
                        <br />
                        Get your key at:{" "}
                        <a
                          href="https://zora.co"
                          target="_blank"
                          rel="noopener"
                          className="underline"
                        >
                          zora.co
                        </a>{" "}
                        (Developer Settings)
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => refetch()}
                      className="self-start px-4 py-2 rounded-md bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs hover:bg-rose-500/30 transition-colors"
                    >
                      Retry fetch
                    </button>
                  </div>
                )}
              </div>

              <div className="glass-strong border border-white/10 rounded-xl overflow-hidden">
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white/5">
                      <tr className="text-left text-xs uppercase tracking-[0.22em] text-gray-400">
                        <th className="px-4 py-3 font-medium">Coin</th>
                        <th className="px-4 py-3 font-medium">Market Cap</th>
                        <th className="px-4 py-3 font-medium">24h Volume</th>
                        <th className="px-4 py-3 font-medium">24h Change</th>
                        <th className="px-4 py-3 font-medium">Holders</th>
                        <th className="px-4 py-3 font-medium">Launched</th>
                        {/* <th className="px-4 py-3 font-medium">Status</th> */}
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-12 text-center text-gray-400"
                          >
                            Fetching creator coins from Zora…
                          </td>
                        </tr>
                      ) : coins.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-12 text-center text-gray-400"
                          >
                            No coins match the current filters.
                          </td>
                        </tr>
                      ) : (
                        coins.map((coin) => (
                          <tr
                            key={coin.id}
                            className="border-t border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                            onClick={() => {
                              setSelectedCoin(coin);
                              setDrawerOpen(true);
                            }}
                          >
                            <td className="px-4 py-4 align-top">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center relative">
                                  {coin.imageUrl ? (
                                    <Image
                                      src={coin.imageUrl}
                                      alt={coin.symbol}
                                      width={40}
                                      height={40}
                                      className="w-10 h-10 rounded-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                        const fallback =
                                          e.currentTarget.parentElement?.querySelector(
                                            ".fallback-avatar"
                                          );
                                        if (fallback)
                                          fallback.classList.remove("hidden");
                                      }}
                                    />
                                  ) : null}
                                  <div
                                    className={`w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm fallback-avatar absolute inset-0 ${
                                      coin.imageUrl ? "hidden" : ""
                                    }`}
                                  >
                                    {coin.symbol.charAt(0).toUpperCase()}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-white">
                                    {coin.symbol}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {coin.creatorHandle || coin.name}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top text-gray-200">
                              {formatCurrency(coin.marketCap)}
                            </td>
                            <td className="px-4 py-4 align-top text-gray-200">
                              {formatCurrency(coin.volume24h)}
                            </td>
                            <td
                              className={`px-4 py-4 align-top font-medium ${
                                coin.priceChange24h >= 0
                                  ? "text-emerald-400"
                                  : "text-rose-400"
                              }`}
                            >
                              {formatPercentage(coin.priceChange24h)}
                            </td>
                            <td className="px-4 py-4 align-top text-gray-200">
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3 text-gray-500" />
                                {coin.uniqueHolders.toLocaleString()}
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top text-gray-300">
                              {formatRelativeTime(coin.createdAt)}
                            </td>
                            {/* <td className="px-4 py-4 align-top">
                              <StatusChip status={coin.status} />
                            </td> */}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden">
                  {isLoading ? (
                    <div className="px-4 py-12 text-center text-gray-400">
                      Fetching creator coins from Zora…
                    </div>
                  ) : coins.length === 0 ? (
                    <div className="px-4 py-12 text-center text-gray-400">
                      No coins match the current filters.
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {coins.map((coin) => (
                        <div
                          key={coin.id}
                          className="p-4 hover:bg-white/5 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedCoin(coin);
                            setDrawerOpen(true);
                          }}
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1">
                                <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center relative">
                                  {coin.imageUrl ? (
                                    <Image
                                      src={coin.imageUrl}
                                      alt={coin.symbol}
                                      width={48}
                                      height={48}
                                      className="w-12 h-12 rounded-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                        const fallback =
                                          e.currentTarget.parentElement?.querySelector(
                                            ".fallback-avatar"
                                          );
                                        if (fallback)
                                          fallback.classList.remove("hidden");
                                      }}
                                    />
                                  ) : null}
                                  <div
                                    className={`w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg fallback-avatar absolute inset-0 ${
                                      coin.imageUrl ? "hidden" : ""
                                    }`}
                                  >
                                    {coin.symbol.charAt(0).toUpperCase()}
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-white leading-snug">
                                    {coin.symbol}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {coin.creatorHandle || coin.name}
                                  </div>
                                </div>
                              </div>
                              {/* <StatusChip status={coin.status} /> */}
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <div className="text-gray-500 uppercase tracking-wider text-[10px]">
                                  Market Cap
                                </div>
                                <div className="text-gray-200 font-medium mt-1">
                                  {formatCurrency(coin.marketCap)}
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-500 uppercase tracking-wider text-[10px]">
                                  24h Volume
                                </div>
                                <div className="text-gray-200 font-medium mt-1">
                                  {formatCurrency(coin.volume24h)}
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-500 uppercase tracking-wider text-[10px]">
                                  24h Change
                                </div>
                                <div
                                  className={`font-medium mt-1 ${
                                    coin.priceChange24h >= 0
                                      ? "text-emerald-400"
                                      : "text-rose-400"
                                  }`}
                                >
                                  {formatPercentage(coin.priceChange24h)}
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-500 uppercase tracking-wider text-[10px]">
                                  Holders
                                </div>
                                <div className="text-gray-300 mt-1">
                                  {coin.uniqueHolders.toLocaleString()}
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

              {coins.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-400 mt-4">
                  <div>
                    Page {pageHistory.length + 1} • {coins.length} coins on this
                    page
                    {hasNextPage && " • More available"}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrevPage}
                      disabled={pageHistory.length === 0}
                      className="px-3 py-1.5 rounded-md border border-white/10 bg-black/60 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Prev
                    </button>

                    <button
                      type="button"
                      onClick={handleNextPage}
                      disabled={!hasNextPage}
                      className="px-3 py-1.5 rounded-md border border-white/10 bg-black/60 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </section>
          </main>
        </div>
      </SidebarInset>

      <Sheet
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) {
            setSelectedCoin(null);
          }
        }}
      >
        <SheetContent
          side="right"
          className="bg-black/95 border-l border-white/10 w-full sm:max-w-md overflow-y-auto"
        >
          {selectedCoin && (
            <>
              <SheetHeader className="border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  {selectedCoin.imageUrl ? (
                    <Image
                      src={selectedCoin.imageUrl}
                      alt={selectedCoin.symbol}
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white font-bold text-xl">
                      {selectedCoin.symbol.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <SheetTitle className="text-base sm:text-lg text-white pr-8 leading-snug">
                      {selectedCoin.symbol}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-gray-400 pt-1">
                      {selectedCoin.name}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <StatusChip status={selectedCoin.status} />
                  <span
                    className={`text-xs font-medium ${
                      selectedCoin.priceChange24h >= 0
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }`}
                  >
                    {formatPercentage(selectedCoin.priceChange24h)} 24h
                  </span>
                </div>

                {selectedCoin.status === "new" && (
                  <div className="glass border border-amber-500/30 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-200">
                        <div className="font-semibold">
                          Low liquidity, higher slippage risk
                        </div>
                        <div className="mt-1 opacity-90">
                          This coin launched less than 24h ago. Exercise caution
                          and verify the contract before trading.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedCoin.description && (
                  <div className="glass border border-white/10 rounded-lg p-3 sm:p-4">
                    <h3 className="text-xs uppercase tracking-[0.22em] text-gray-400 mb-2">
                      Description
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                      {selectedCoin.description}
                    </p>
                  </div>
                )}

                <div className="glass border border-white/10 rounded-lg p-3 sm:p-4">
                  <h3 className="text-xs uppercase tracking-[0.22em] text-gray-400">
                    Market Metrics
                  </h3>
                  <div className="mt-3 space-y-3 text-xs sm:text-sm text-gray-200">
                    <div className="flex items-center justify-between">
                      <span>Market Cap</span>
                      <span className="font-medium">
                        {formatCurrency(selectedCoin.marketCap)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>24h Volume</span>
                      <span className="font-medium">
                        {formatCurrency(selectedCoin.volume24h)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>24h Change</span>
                      <span
                        className={`font-medium ${
                          selectedCoin.priceChange24h >= 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {formatPercentage(selectedCoin.priceChange24h)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Unique Holders</span>
                      <span className="font-medium flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {selectedCoin.uniqueHolders.toLocaleString()}
                      </span>
                    </div>
                    {selectedCoin.totalSupply && (
                      <div className="flex items-center justify-between">
                        <span>Total Supply</span>
                        <span className="font-medium font-mono text-xs">
                          {Number(selectedCoin.totalSupply).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="glass border border-white/10 rounded-lg p-3 sm:p-4 space-y-3 text-xs sm:text-sm text-gray-200">
                  <div className="flex items-center justify-between">
                    <span>Launched</span>
                    <span className="text-right">
                      {formatDate(selectedCoin.createdAt)}
                    </span>
                  </div>
                  {selectedCoin.zoraCreatorUrl && (
                    <div className="flex items-center justify-between">
                      <span>Creator</span>
                      <a
                        href={selectedCoin.zoraCreatorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-right text-emerald-300 hover:text-emerald-200 text-xs flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {selectedCoin.creatorHandle || "View on Zora"}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span>Coin Page</span>
                    <a
                      href={selectedCoin.zoraCoinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-right text-emerald-300 hover:text-emerald-200 text-xs flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View on Zora
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Contract</span>
                    <a
                      href={selectedCoin.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-right text-emerald-300 hover:text-emerald-200 font-mono text-xs flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {`${selectedCoin.address.slice(
                        0,
                        6
                      )}...${selectedCoin.address.slice(-4)}`}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                <div className="space-y-2">
                  <a
                    href={selectedCoin.tradingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block glass border border-emerald-500/30 rounded-lg p-3 sm:p-4 text-center text-sm font-semibold text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 transition-all"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Trade on Uniswap
                      <ExternalLink className="h-4 w-4" />
                    </div>
                  </a>

                  <p className="text-center text-[10px] text-gray-500">
                    Opens Uniswap in a new tab. We don&apos;t facilitate
                    trading.
                  </p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}
