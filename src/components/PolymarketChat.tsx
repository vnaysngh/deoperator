"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolOrDynamicToolName,
  isToolOrDynamicToolUIPart
} from "ai";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import type {
  NormalizedPolymarketMarket,
  PolymarketTimeframe
} from "@/lib/polymarket";
import type { PolymarketTrade } from "@/lib/polymarket-trades";

type PolymarketChatProps = {
  markets: NormalizedPolymarketMarket[];
  trades: PolymarketTrade[];
  activeCategory: string;
  timeframe: PolymarketTimeframe;
  isLoading: boolean;
  onCreateTab?: (descriptor: { type: "trades" }) => void;
};

const MAX_MARKET_CONTEXT = 40;
const MAX_TRADES_CONTEXT = 40;

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
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

const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return `${(value * 100).toFixed(1)}%`;
};

const humanizeToolName = (name: string): string => {
  const cleaned = name.replace(/^get/i, "");
  const spaced = cleaned.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  if (!spaced) {
    return name;
  }
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const formatTimeframe = (
  input: number | string | null | undefined
): string | null => {
  if (typeof input === "number") {
    if (input >= 1440) {
      const days = input / 1440;
      return `${days.toFixed(days % 1 === 0 ? 0 : 1)}d lookback`;
    }
    if (input >= 60) {
      const hours = input / 60;
      return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h lookback`;
    }
    return `${input} minute lookback`;
  }
  if (typeof input === "string" && input.length > 0) {
    return `${input} timeframe`;
  }
  return null;
};

const buildMarketKey = (market: NormalizedPolymarketMarket, index: number) =>
  market.id ?? market.url ?? `${market.question}-${index}`;

const buildTradeKey = (trade: PolymarketTrade, index: number) =>
  trade.txHash ?? trade.id ?? `${trade.timestamp}-${trade.marketId ?? "unknown"}-${index}`;

const getTradeUrl = (trade: PolymarketTrade): string | null => {
  if (trade.marketSlug) {
    return `https://polymarket.com/market/${trade.marketSlug}`;
  }
  if (trade.eventSlug) {
    return `https://polymarket.com/event/${trade.eventSlug}`;
  }
  return null;
};

type ToolMessagePart = ToolUIPart | DynamicToolUIPart;

const PolymarketToolInvocation = ({ part }: { part: ToolMessagePart }) => {
  const toolName = getToolOrDynamicToolName(part);
  const heading = humanizeToolName(toolName);

  if (part.state === "input-streaming" || part.state === "input-available") {
    return (
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
        Preparing {heading} request…
      </div>
    );
  }

  if (part.state === "output-error") {
    return (
      <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
        Unable to load {heading.toLowerCase()}: {part.errorText ?? "Unknown error"}.
      </div>
    );
  }

  if (part.state !== "output-available" || !part.output) {
    return null;
  }

  const output = part.output as Record<string, unknown>;
  const successValue =
    "success" in output && typeof output.success === "boolean"
      ? (output.success as boolean)
      : null;
  const summary =
    (typeof output.message === "string" && output.message) ||
    (typeof output.userMessage === "string" && output.userMessage) ||
    null;
  const timeframe =
    formatTimeframe(
      typeof output.timeframeMinutes === "number"
        ? output.timeframeMinutes
        : typeof output.timeframe === "string"
        ? output.timeframe
        : null
    ) ?? null;

  const markets = Array.isArray((output as { markets?: unknown }).markets)
    ? ((output as { markets?: NormalizedPolymarketMarket[] }).markets ?? [])
    : [];

  const trades = Array.isArray((output as { trades?: unknown }).trades)
    ? ((output as { trades?: PolymarketTrade[] }).trades ?? [])
    : [];

  return (
    <div className="rounded-lg border border-white/15 bg-black/40 p-3 text-xs text-gray-200 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-emerald-200 uppercase tracking-[0.18em]">
          {heading}
        </span>
        <span className="text-[10px] text-gray-500 uppercase">
          Tool output
        </span>
      </div>
      {timeframe && (
        <p className="text-[11px] text-emerald-200/80">{timeframe}</p>
      )}
      {summary && (
        <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">
          {summary}
        </p>
      )}

      {markets.length > 0 && (
        <ul className="space-y-2">
          {markets.slice(0, 5).map((market, index) => (
            <li
              key={buildMarketKey(market, index)}
              className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-gray-200"
            >
              <p className="font-medium text-white leading-snug">
                {market.question}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400">
                {market.category && <span>{market.category}</span>}
                <span>Total {formatCurrency(market.totalVolume)}</span>
                <span>YES {formatPercent(market.lastPriceYes)}</span>
              </div>
              {market.url && (
                <a
                  href={market.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-[11px] text-emerald-300 hover:text-emerald-200 transition-colors"
                >
                  View on Polymarket ↗
                </a>
              )}
            </li>
          ))}
          {markets.length > 5 && (
            <li className="px-1 text-[11px] text-gray-500">
              + {markets.length - 5} more markets available in this slice.
            </li>
          )}
        </ul>
      )}

      {trades.length > 0 && (
        <ul className="space-y-2">
          {trades.slice(0, 5).map((trade, index) => {
            const url = getTradeUrl(trade);
            const trader =
              trade.traderName ??
              trade.traderPseudonym ??
              (trade.trader
                ? `${trade.trader.slice(0, 6)}…${trade.trader.slice(-4)}`
                : "unknown");
            const tradeDate = trade.timestamp ? new Date(trade.timestamp) : null;
            const timestampLabel =
              tradeDate && !Number.isNaN(tradeDate.getTime())
                ? tradeDate.toLocaleString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    month: "short",
                    day: "numeric"
                  })
                : null;
            return (
              <li
                key={buildTradeKey(trade, index)}
                className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-gray-200 space-y-1"
              >
                <p className="font-medium text-white leading-snug">
                  {trade.marketQuestion ?? "Unknown market"}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400">
                  <span>{(trade.side ?? "").toUpperCase()}</span>
                  {trade.outcome && <span>{trade.outcome}</span>}
                  {trade.notional !== null && trade.notional !== undefined && (
                    <span>Size {formatCurrency(trade.notional)}</span>
                  )}
                  {trade.price !== null && trade.price !== undefined && (
                    <span>@ {trade.price.toFixed(3)}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                  <span>Trader: {trader}</span>
                  {timestampLabel && <span>{timestampLabel}</span>}
                </div>
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-[11px] text-emerald-300 hover:text-emerald-200 transition-colors"
                  >
                    View trade ↗
                  </a>
                )}
              </li>
            );
          })}
          {trades.length > 5 && (
            <li className="px-1 text-[11px] text-gray-500">
              + {trades.length - 5} additional trades captured.
            </li>
          )}
        </ul>
      )}

      {successValue === false && summary === null && (
        <p className="text-sm text-rose-300">
          The tool call finished without a user-facing message.
        </p>
      )}
    </div>
  );
};

export function PolymarketChat({
  markets,
  trades,
  activeCategory,
  timeframe,
  isLoading,
  onCreateTab
}: PolymarketChatProps) {
  const [input, setInput] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const contextPayload = useMemo(() => {
    const trimmed = markets.slice(0, MAX_MARKET_CONTEXT);
    return JSON.stringify(trimmed);
  }, [markets]);

  const tradesPayload = useMemo(() => {
    const trimmed = trades.slice(0, MAX_TRADES_CONTEXT);
    return JSON.stringify(trimmed);
  }, [trades]);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/polymarket-chat",
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers: Record<string, string> = {
          ...(init?.headers as Record<string, string>),
          "x-polymarket-timeframe": timeframe,
          "x-polymarket-markets": contextPayload,
          "x-polymarket-trades": tradesPayload
        };

        if (activeCategory && activeCategory !== "all") {
          headers["x-polymarket-category"] = activeCategory;
        }

        return fetch(input, {
          ...init,
          headers
        });
      }
    })
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const suggestedPrompts = [
    "Top 5 markets by 24h volume",
    "What are the largest trades in the last 24 hours?"
  ];

  const canInteract =
    (markets.length > 0 || trades.length > 0) &&
    !isLoading &&
    status !== "streaming" &&
    !error;

  const maxScrollHeight = isExpanded
    ? "max-h-[480px] sm:max-h-[520px]"
    : "max-h-[360px]";
  const isProcessing = status === "submitted" || status === "streaming";

  return (
    <div className="glass-strong rounded-xl border border-white/10 overflow-hidden flex flex-col transition-all duration-300 ease-out w-full">
      <div className="p-3 sm:p-4 border-b border-white/10 bg-gradient-to-r from-emerald-600/10 to-cyan-600/10">
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20">
              <span className="text-lg">📈</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-white text-sm sm:text-base">Polymarket Intelligence</h3>
              <p className="text-[10px] sm:text-xs text-gray-400 hidden sm:block">
                Ask the agent about prediction market flow and sentiment.
              </p>
              <p className="text-[10px] text-gray-400 sm:hidden">
                Ask about markets & trades
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {isProcessing && (
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-emerald-200/80 px-3 py-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300" />
                </span>
                Syncing…
              </div>
            )}
            {isProcessing && (
              <div className="sm:hidden relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300" />
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded((previous) => !previous)}
              aria-expanded={isExpanded}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-emerald-200 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
            >
              <span className="sr-only">
                {isExpanded ? "Collapse Polymarket chat" : "Expand Polymarket chat"}
              </span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`h-4 w-4 transition-transform duration-200 ${
                  isExpanded ? "" : "-rotate-90"
                }`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div
        className={`${maxScrollHeight} ${
          messages.length > 0 ? "flex-1" : ""
        } overflow-y-auto p-4 space-y-3`}
      >
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Try one of these queries to explore market insights:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setInput(prompt);
                    setTimeout(() => inputRef.current?.focus(), 80);
                  }}
                  className="text-left text-xs glass rounded-lg p-3 hover:bg-white/10 transition-colors text-gray-300"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                message.role === "user"
                  ? "bg-emerald-600/20 text-white border border-emerald-500/30"
                  : "glass text-gray-200"
              }`}
            >
              <div className="space-y-3 leading-relaxed">
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return (
                      <p
                        key={index}
                        className="whitespace-pre-wrap break-words text-sm text-inherit"
                      >
                        {part.text}
                      </p>
                    );
                  }

                  if (isToolOrDynamicToolUIPart(part)) {
                    return <PolymarketToolInvocation key={index} part={part} />;
                  }

                  return null;
                })}
              </div>
            </div>
          </div>
        ))}

        {status === "streaming" && (
          <div className="flex justify-start">
            <div className="glass rounded-lg px-3 py-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.16s]"></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.32s]"></div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
            Something went wrong while talking to the agent. Try again in a few
            seconds.
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!input.trim() || !canInteract) return;
          const normalizedInput = input.trim().toLowerCase();
          if (
            onCreateTab &&
            /(largest|biggest|top)\s+(?:polymarket\s+)?(trade|bet)/.test(
              normalizedInput
            )
          ) {
            onCreateTab({ type: "trades" });
          }
          setIsExpanded(true);
          sendMessage({ text: input });
          setInput("");
        }}
        className="p-3 border-t border-white/10"
      >
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about Polymarket trends..."
            disabled={!canInteract}
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-white placeholder:text-gray-500 text-sm transition-colors"
          />
          <button
            type="submit"
            disabled={!canInteract || !input.trim()}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all"
          >
            →
          </button>
        </div>
        {(!markets.length || isLoading) && (
          <p className="text-[11px] text-gray-500 mt-2">
            Live data is loading — the agent will respond once the latest
            markets and trades are ready.
          </p>
        )}
      </form>
    </div>
  );
}
