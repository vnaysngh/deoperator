"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type {
  NormalizedPolymarketMarket,
  PolymarketTimeframe
} from "@/lib/polymarket";

type PolymarketChatProps = {
  markets: NormalizedPolymarketMarket[];
  activeCategory: string;
  timeframe: PolymarketTimeframe;
  isLoading: boolean;
};

const MAX_MARKET_CONTEXT = 40;

export function PolymarketChat({
  markets,
  activeCategory,
  timeframe,
  isLoading
}: PolymarketChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const contextPayload = useMemo(() => {
    const trimmed = markets.slice(0, MAX_MARKET_CONTEXT);
    return JSON.stringify(trimmed);
  }, [markets]);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/polymarket-chat",
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers: Record<string, string> = {
          ...(init?.headers as Record<string, string>),
          "x-polymarket-timeframe": timeframe,
          "x-polymarket-markets": contextPayload
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
    "Show only crypto-related prediction markets",
    "Which markets are ending soon?",
    "Summarize trends in political prediction markets this week."
  ];

  const canInteract =
    markets.length > 0 && !isLoading && status !== "streaming" && !error;

  return (
    <div className="glass-strong rounded-xl border border-white/10 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-white/10 bg-gradient-to-r from-emerald-600/10 to-cyan-600/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20">
            <span className="text-lg">📈</span>
          </div>
          <div>
            <h3 className="font-semibold text-white">Polymarket Intelligence</h3>
            <p className="text-xs text-gray-400">
              Ask the agent about prediction market flow and sentiment.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[360px]">
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
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                message.role === "user"
                  ? "bg-emerald-600/20 text-white border border-emerald-500/30"
                  : "glass text-gray-200"
              }`}
            >
              <div className="whitespace-pre-wrap break-words leading-relaxed">
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return <span key={index}>{part.text}</span>;
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
            Live market data is loading — the agent will respond once the table
            is ready.
          </p>
        )}
      </form>
    </div>
  );
}
