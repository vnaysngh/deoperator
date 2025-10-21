"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { WalletConnect } from "@/components/WalletConnect";
import { PolymarketChat } from "@/components/PolymarketChat";
import type {
  NormalizedPolymarketMarket,
  PolymarketTimeframe
} from "@/lib/polymarket";
import { getVolumeForTimeframe } from "@/lib/polymarket";
import type { PolymarketTrade } from "@/lib/polymarket-trades";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";

type FetchResponse = {
  markets: NormalizedPolymarketMarket[];
  source: "primary" | "fallback";
  trades?: PolymarketTrade[];
};

const DEFAULT_TIMEFRAME: PolymarketTimeframe = "24h";
const DEFAULT_TIMEFRAME_LABEL = "24h";
const PAGE_SIZE = 10;
type SortKey = "volume" | "liquidity";
type ResultTab =
  | {
      id: string;
      label: string;
      type: "trades";
      trades: PolymarketTrade[];
      createdAt: string;
    };
const DEFAULT_CATEGORY = "Crypto";

const formatCategoryLabel = (value: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    return "General";
  }
  const segments = normalized
    .split(/[-_]/)
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return normalized;
  }
  return segments
    .map((segment) => {
      if (segment.toUpperCase() === segment && segment.length <= 3) {
        return segment.toUpperCase();
      }
      return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
    })
    .join(" ");
};

const formatCurrency = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
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

const formatDate = (isoDate: string | null): string => {
  if (!isoDate) {
    return "—";
  }
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

const formatRelativeTime = (isoDate: string | null): string => {
  if (!isoDate) return "No close date";
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) {
    return "No close date";
  }
  const now = Date.now();
  const diff = target.getTime() - now;
  const absDiff = Math.abs(diff);

  const minutes = Math.round(absDiff / (1000 * 60));
  if (minutes < 60) {
    return diff >= 0 ? `Closes in ${minutes} min` : `Closed ${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return diff >= 0 ? `Closes in ${hours} hrs` : `Closed ${hours} hrs ago`;
  }
  const days = Math.round(hours / 24);
  return diff >= 0 ? `Closes in ${days} days` : `Closed ${days} days ago`;
};

const formatTimestamp = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date(iso));

const formatSize = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "—";
  if (Math.abs(value) >= 1) {
    return value.toFixed(2);
  }
  return value.toFixed(4);
};

const formatPrice = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "—";
  return value.toFixed(4);
};

const tradeSideClasses: Record<string, string> = {
  buy: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  sell: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
  unknown: "bg-white/10 text-gray-300 border border-white/10"
};

const formatTraderDisplay = (trade: PolymarketTrade): string => {
  if (trade.traderName) return trade.traderName;
  if (trade.traderPseudonym) return trade.traderPseudonym;
  if (trade.trader) {
    return `${trade.trader.slice(0, 6)}…${trade.trader.slice(-4)}`;
  }
  return "unknown";
};

const tradeUrl = (trade: PolymarketTrade): string | null => {
  if (trade.marketSlug) {
    return `https://polymarket.com/market/${trade.marketSlug}`;
  }
  if (trade.eventSlug) {
    return `https://polymarket.com/event/${trade.eventSlug}`;
  }
  return null;
};

export default function PolymarketPage() {
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORY);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] =
    useState<NormalizedPolymarketMarket | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const defaultCategoryAppliedRef = useRef(false);
  const [resultTabs, setResultTabs] = useState<ResultTab[]>([]);
  const [activeView, setActiveView] = useState<string>("markets");

  const { data, isLoading, isFetching, error, refetch } =
    useQuery<FetchResponse>({
      queryKey: ["polymarket", "markets"],
      queryFn: async () => {
        const response = await fetch("/api/polymarket/markets", {
          cache: "no-store"
        });
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Unable to load Polymarket markets");
        }
        return (await response.json()) as FetchResponse;
      }
      // refetchInterval: 120_000,
      // refetchOnWindowFocus: true
    });

  const markets = useMemo(() => data?.markets ?? [], [data]);
  const trades = useMemo(() => data?.trades ?? [], [data?.trades]);

  const { datasetMarkets, usingHistoricalSnapshot } = useMemo(() => {
    const now = Date.now();
    const activeCandidates = markets.filter((market) => {
      if (market.isResolved) return false;
      if (market.isActive) return true;
      if (!market.endDate) return true;
      const endTime = new Date(market.endDate).getTime();
      if (Number.isNaN(endTime)) {
        return true;
      }
      // Allow markets that ended within the last 12 hours in case settlement lags
      const twelveHoursMs = 12 * 60 * 60 * 1000;
      return endTime + twelveHoursMs >= now;
    });

    if (activeCandidates.length > 0) {
      return {
        datasetMarkets: activeCandidates,
        usingHistoricalSnapshot: false
      };
    }

    return {
      datasetMarkets: markets,
      usingHistoricalSnapshot: true
    };
  }, [markets]);

  useEffect(() => {
    setCurrentPage(1);
  }, [category, sortKey]);

  const categories = useMemo(() => {
    const unique = new Map<string, string>();
    datasetMarkets.forEach((market) => {
      if (market.category) {
        const key = market.category.toLowerCase();
        if (!unique.has(key)) {
          unique.set(key, market.category);
        }
      }
      if (market.subcategory) {
        const formatted = market.subcategory.trim();
        if (formatted.length > 0) {
          const key = formatted.toLowerCase();
          if (!unique.has(key)) {
            unique.set(key, formatted);
          }
        }
      }
    });
    const sorted = Array.from(unique.values()).sort((a, b) =>
      a.localeCompare(b)
    );
    return ["all", ...sorted];
  }, [datasetMarkets]);

  useEffect(() => {
    const hasDefaultCategory = categories.some(
      (entry) => entry.toLowerCase() === DEFAULT_CATEGORY.toLowerCase()
    );

    if (hasDefaultCategory && !defaultCategoryAppliedRef.current) {
      if (category.toLowerCase() !== DEFAULT_CATEGORY.toLowerCase()) {
        setCategory(DEFAULT_CATEGORY);
      }
      defaultCategoryAppliedRef.current = true;
      return;
    }

    if (
      !hasDefaultCategory &&
      category.toLowerCase() === DEFAULT_CATEGORY.toLowerCase()
    ) {
      setCategory("all");
      defaultCategoryAppliedRef.current = true;
    }
  }, [categories, category]);

  const filteredMarkets = useMemo(() => {
    if (category === "all") {
      return datasetMarkets;
    }
    const lowered = category.toLowerCase();
    return datasetMarkets.filter((market) => {
      const matchesCategory =
        market.category?.toLowerCase() === lowered ||
        market.subcategory?.toLowerCase() === lowered;
      const matchesTag = market.tags.some(
        (tag) => tag.toLowerCase() === lowered
      );
      return matchesCategory || matchesTag;
    });
  }, [category, datasetMarkets]);

  const sortedMarkets = useMemo(() => {
    const list = filteredMarkets.slice();
    if (sortKey === "volume") {
      list.sort(
        (left, right) => (right.totalVolume ?? 0) - (left.totalVolume ?? 0)
      );
    } else {
      list.sort(
        (left, right) => (right.liquidity ?? 0) - (left.liquidity ?? 0)
      );
    }
    return list;
  }, [filteredMarkets, sortKey]);

  const topTrades = useMemo(
    () =>
      trades
        .filter((trade) => trade.notional !== null && trade.marketQuestion)
        .slice(0, 12),
    [trades]
  );

  const ensureTradesTab = (forceActivate = false) => {
    setResultTabs((prev) => {
      const updatedTab: ResultTab = {
        id: "largest-trades",
        label: "Largest trades (24h)",
        type: "trades",
        trades: topTrades,
        createdAt: new Date().toISOString()
      };
      const existing = prev.find((tab) => tab.type === "trades");
      if (existing) {
        return prev.map((tab) => (tab.type === "trades" ? updatedTab : tab));
      }
      return [...prev, updatedTab];
    });

    if (forceActivate) {
      setActiveView("largest-trades");
    }
  };

  useEffect(() => {
    setResultTabs((prev) => {
      const updatedTab: ResultTab = {
        id: "largest-trades",
        label: "Largest trades (24h)",
        type: "trades",
        trades: topTrades,
        createdAt: new Date().toISOString()
      };
      const existing = prev.find((tab) => tab.type === "trades");
      if (existing) {
        return prev.map((tab) => (tab.type === "trades" ? updatedTab : tab));
      }
      return [...prev, updatedTab];
    });
  }, [topTrades]);

  const tabOptions = useMemo(() => {
    if (resultTabs.length === 0) {
      return [] as Array<{ id: string; label: string }>;
    }
    return [
      { id: "markets", label: "Markets" },
      ...resultTabs.map((tab) => ({ id: tab.id, label: tab.label }))
    ];
  }, [resultTabs]);

  const tradeTab = resultTabs.find((tab) => tab.id === "largest-trades");

  useEffect(() => {
    if (resultTabs.length === 0 && activeView !== "markets") {
      setActiveView("markets");
    }
  }, [resultTabs.length, activeView]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedMarkets.length / PAGE_SIZE) || 1
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedMarkets = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedMarkets.slice(start, start + PAGE_SIZE);
  }, [sortedMarkets, currentPage]);

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
                      polyIntelligence
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1">
                      Explore trending prediction markets on Polymarket.
                    </p>
                  </div>
                </div>
                <div className="sm:flex sm:items-center sm:justify-end">
                  <WalletConnect />
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-20">
            <section className="pb-6">
              <PolymarketChat
                markets={sortedMarkets}
                trades={topTrades}
                activeCategory={category}
                timeframe={DEFAULT_TIMEFRAME}
                isLoading={isLoading}
                onCreateTab={(descriptor) => {
                  if (descriptor.type === "trades") {
                    ensureTradesTab(true);
                  }
                }}
              />
            </section>

            {tabOptions.length > 0 && (
              <div className="flex justify-end">
                <div className="glass border border-white/10 rounded-xl p-1 inline-flex bg-white/5">
                  {tabOptions.map((option) => {
                    const active = activeView === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setActiveView(option.id)}
                        className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                          active
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "text-gray-400 hover:text-emerald-200"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeView === "markets" && (
              <section className="space-y-6">
              <div className="glass-strong border border-white/10 rounded-xl p-4 sm:p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white uppercase tracking-[0.32em]">
                      Market Controls
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Sorted by total trading volume. Data refreshes every two
                      minutes.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <label className="flex flex-col gap-1 text-xs text-gray-400">
                      Category
                      <select
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                      >
                        {categories.map((option) => (
                          <option key={option} value={option}>
                            {option === "all"
                              ? "All markets"
                              : formatCategoryLabel(option)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-gray-400">
                      Sort by
                      <select
                        value={sortKey}
                        onChange={(event) =>
                          setSortKey(event.target.value as SortKey)
                        }
                        className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                      >
                        <option value="volume">Total volume</option>
                        <option value="liquidity">Liquidity</option>
                      </select>
                    </label>
                  </div>
                </div>
                {isFetching && (
                  <div className="mt-4 inline-flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Syncing with Polymarket…
                  </div>
                )}
                {usingHistoricalSnapshot && (
                  <div className="mt-4 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                    Live markets were unavailable, so you are seeing the latest
                    cached Polymarket snapshot (may contain resolved markets).
                  </div>
                )}
                {error && (
                  <div className="mt-4 flex flex-col gap-3 glass border border-rose-500/20 rounded-lg p-4 text-rose-300">
                    <p className="text-sm">
                      Unable to load Polymarket data right now.
                    </p>
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
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white/5">
                      <tr className="text-left text-xs uppercase tracking-[0.22em] text-gray-400">
                        <th className="px-4 py-3 font-medium">Market</th>
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 font-medium">Total Volume</th>
                        <th className="px-4 py-3 font-medium">Liquidity</th>
                        <th className="px-4 py-3 font-medium">End Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-12 text-center text-gray-400"
                          >
                            Fetching live Polymarket order flow…
                          </td>
                        </tr>
                      ) : sortedMarkets.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-12 text-center text-gray-400"
                          >
                            No markets match the current filters.
                          </td>
                        </tr>
                      ) : (
                        paginatedMarkets.map((market) => {
                          return (
                            <tr
                              key={market.id}
                              className="border-t border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                              onClick={() => {
                                setSelectedMarket(market);
                                setDrawerOpen(true);
                              }}
                            >
                              <td className="px-4 py-4 align-top">
                                <div className="text-sm font-medium text-white">
                                  {market.question}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {formatRelativeTime(market.endDate)}
                                </div>
                              </td>
                              <td className="px-4 py-4 align-top text-gray-300">
                                {formatCategoryLabel(market.category)}
                              </td>
                              <td className="px-4 py-4 align-top text-gray-200">
                                {formatCurrency(market.totalVolume)}
                              </td>
                              <td className="px-4 py-4 align-top text-gray-200">
                                {formatCurrency(market.liquidity)}
                              </td>
                              <td className="px-4 py-4 align-top text-gray-300">
                                {formatDate(market.endDate)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {sortedMarkets.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-400 mt-4">
                  <div>
                    Page {currentPage} of {totalPages} •{" "}
                    {sortedMarkets.length.toLocaleString()} markets
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-md border border-white/10 bg-black/60 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded-md border border-white/10 bg-black/60 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </section>
            )}

            {activeView === "largest-trades" && (
              <section className="space-y-6">
                <div className="glass-strong border border-white/10 rounded-xl p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-white uppercase tracking-[0.32em]">
                        Largest trades (last 24h)
                      </h2>
                      <p className="text-xs text-gray-400 mt-1">
                        Pulled from the Polymarket CLOB trade feed. Sorted by quote notional.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="glass-strong border border-white/10 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-white/5">
                        <tr className="text-left text-xs uppercase tracking-[0.22em] text-gray-400">
                          <th className="px-4 py-3 font-medium">Market</th>
                          <th className="px-4 py-3 font-medium">Side</th>
                          <th className="px-4 py-3 font-medium">Notional</th>
                          <th className="px-4 py-3 font-medium">Size</th>
                          <th className="px-4 py-3 font-medium">Price</th>
                          <th className="px-4 py-3 font-medium">Trader</th>
                          <th className="px-4 py-3 font-medium">Time</th>
                          <th className="px-4 py-3 font-medium">Tx</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoading && (tradeTab?.trades.length ?? 0) === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                              Loading recent trades…
                            </td>
                          </tr>
                        ) : (tradeTab?.trades.length ?? 0) === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                              No trades observed in the last 24 hours.
                            </td>
                          </tr>
                        ) : (
                          (tradeTab?.trades ?? []).map((trade) => {
                            const url = tradeUrl(trade);
                            const txHash = trade.txHash
                              ? `${trade.txHash.slice(0, 6)}…${trade.txHash.slice(-4)}`
                              : "—";
                            return (
                              <tr
                                key={`${trade.id}-${trade.timestamp}`}
                                className="border-t border-white/5 hover:bg-white/5 transition-colors"
                              >
                                <td className="px-4 py-4 align-top text-gray-200">
                                  {url ? (
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:text-emerald-300 underline-offset-4 hover:underline"
                                    >
                                      {trade.marketQuestion}
                                    </a>
                                  ) : (
                                    trade.marketQuestion
                                  )}
                                  <div className="text-xs text-gray-500 mt-1">
                                    {trade.outcome ?? "—"}
                                  </div>
                                </td>
                                <td className="px-4 py-4 align-top">
                                  <span
                                    className={`px-2 py-1 rounded-md text-xs font-medium ${
                                      tradeSideClasses[trade.side] ?? tradeSideClasses.unknown
                                    }`}
                                  >
                                    {trade.side.toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-4 py-4 align-top text-gray-200">
                                  {formatCurrency(trade.notional)}
                                </td>
                                <td className="px-4 py-4 align-top text-gray-200">
                                  {formatSize(trade.baseAmount)}
                                </td>
                                <td className="px-4 py-4 align-top text-gray-200">
                                  {formatPrice(trade.price)}
                                </td>
                                <td className="px-4 py-4 align-top text-gray-200">
                                  {formatTraderDisplay(trade)}
                                </td>
                                <td className="px-4 py-4 align-top text-gray-400">
                                  {formatTimestamp(trade.timestamp)}
                                </td>
                                <td className="px-4 py-4 align-top text-gray-500 font-mono text-xs">
                                  {trade.txHash ? (
                                    <a
                                      href={`https://polygonscan.com/tx/${trade.txHash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:text-emerald-300"
                                    >
                                      {txHash}
                                    </a>
                                  ) : (
                                    txHash
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </main>
        </div>
      </SidebarInset>

      <Sheet
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) {
            setSelectedMarket(null);
          }
        }}
      >
        <SheetContent
          side="right"
          className="bg-black/95 border-l border-white/10"
        >
          {selectedMarket && (
            <>
              <SheetHeader className="border-b border-white/10">
                <SheetTitle className="text-lg text-white">
                  {selectedMarket.question}
                </SheetTitle>
                <SheetDescription className="text-xs text-gray-400">
                  {formatCategoryLabel(selectedMarket.category)}
                  {selectedMarket.subcategory
                    ? ` → ${formatCategoryLabel(selectedMarket.subcategory)}`
                    : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="p-4 space-y-4 overflow-y-auto">
                <div className="glass border border-white/10 rounded-lg p-4">
                  <h3 className="text-xs uppercase tracking-[0.22em] text-gray-400">
                    Key Metrics
                  </h3>
                  <div className="mt-3 space-y-3 text-sm text-gray-200">
                    <div className="flex items-center justify-between">
                      <span>Total Volume</span>
                      <span className="font-medium">
                        {formatCurrency(selectedMarket.totalVolume)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Volume ({DEFAULT_TIMEFRAME_LABEL})</span>
                      <span className="font-medium">
                        {formatCurrency(
                          getVolumeForTimeframe(
                            selectedMarket,
                            DEFAULT_TIMEFRAME
                          )
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Liquidity</span>
                      <span className="font-medium">
                        {formatCurrency(selectedMarket.liquidity)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Open Interest</span>
                      <span className="font-medium">
                        {formatCurrency(selectedMarket.openInterest)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="glass border border-white/10 rounded-lg p-4 space-y-3 text-sm text-gray-200">
                  <div className="flex items-center justify-between">
                    <span>Closes</span>
                    <span>{formatDate(selectedMarket.endDate)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Created</span>
                    <span>{formatDate(selectedMarket.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Last updated</span>
                    <span>{formatDate(selectedMarket.lastUpdated)}</span>
                  </div>
                </div>

                {selectedMarket.description && (
                  <div className="glass border border-white/10 rounded-lg p-4">
                    <h3 className="text-xs uppercase tracking-[0.22em] text-gray-400 mb-2">
                      Market Context
                    </h3>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {selectedMarket.description}
                    </p>
                  </div>
                )}

                <div className="glass border border-emerald-500/30 rounded-lg p-4">
                  <a
                    href={selectedMarket.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-sm font-semibold text-emerald-300 hover:text-emerald-200 transition-colors"
                  >
                    View on Polymarket ↗
                  </a>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}
