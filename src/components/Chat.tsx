"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DefaultChatTransport } from "ai";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import type { SerializedBridgeQuote } from "@/lib/across-client";
import { useRouter, usePathname } from "next/navigation";
import { CopyIcon, CheckIcon } from "./chat/icons";
import type { MorphoStakingOption } from "./chat/MorphoStakingCard";
import { BridgeQuoteCard } from "./chat/BridgeQuoteCard";
import { MorphoStakingCard } from "./chat/MorphoStakingCard";
import { QuoteDisplay } from "./chat/QuoteDisplay";
import { EntireBalanceQuoteDisplay } from "./chat/EntireBalanceQuoteDisplay";
import { OrderSubmit } from "./chat/OrderSubmit";

// Global ref to track the latest quote timestamp and listeners
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let latestQuoteTimestamp = 0;
const quoteListeners = new Set<() => void>();

function notifyQuoteChange() {
  quoteListeners.forEach((listener) => listener());
}

type ChatProps = {
  sessionId?: string | null;
};

export function Chat({ sessionId }: ChatProps) {
  const [input, setInput] = useState("");
  const { address } = useAccount();
  const normalizedAddress = address?.toLowerCase();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Use a ref to always get the latest address value
  const addressRef = useRef<string | undefined>(normalizedAddress);
  addressRef.current = normalizedAddress;
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyLoadedRef = useRef<string | null>(null);
  const lastSessionRef = useRef<string | null>(null);
  const lastDispatchCountRef = useRef<number>(0);
  const skipNextDispatchRef = useRef<boolean>(false);
  const router = useRouter();
  const pathname = usePathname();

  const [sessionState, setSessionState] = useState<string | null>(
    sessionId ?? null
  );
  const sessionStateRef = useRef<string | null>(sessionState);
  const initialSessionIdRef = useRef<string | null>(sessionId ?? null);

  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

  useEffect(() => {
    const normalized = sessionId ?? null;
    setSessionState((prev) => (prev === normalized ? prev : normalized));
  }, [sessionId]);

  const chatIdRef = useRef<string | null>(null);
  if (chatIdRef.current === null) {
    chatIdRef.current = sessionId
      ? `session:${sessionId}`
      : normalizedAddress
      ? `draft:${normalizedAddress}:${Date.now()}`
      : typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `draft:${crypto.randomUUID()}`
      : `draft:${Math.random().toString(36).slice(2)}`;
  }
  const chatId = chatIdRef.current!;

  const { messages, setMessages, sendMessage, status } = useChat({
    id: chatId,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const currentAddress = addressRef.current || "";
        const currentSessionId = sessionStateRef.current || "";
        console.log(
          "[CLIENT] Sending request with wallet address & session:",
          currentAddress,
          currentSessionId
        );
        const headers: Record<string, string> = {
          ...(init?.headers as Record<string, string>),
          "x-wallet-address": currentAddress
        };
        if (currentSessionId) {
          headers["x-session-id"] = currentSessionId;
        }
        return fetch(input, {
          ...init,
          headers
        }).then((response) => {
          const responseSessionId = response.headers.get("x-session-id");
          if (
            responseSessionId &&
            sessionStateRef.current !== responseSessionId
          ) {
            setSessionState(responseSessionId);
          }
          return response;
        });
      }
    })
  });

  useEffect(() => {
    if (!normalizedAddress) {
      chatIdRef.current = null;
      setSessionState(null);
      sessionStateRef.current = null;
      initialSessionIdRef.current = null;
      historyLoadedRef.current = null;
      lastSessionRef.current = null;
      lastDispatchCountRef.current = 0;
      skipNextDispatchRef.current = false;
      setMessages([]);

      if (
        typeof pathname === "string" &&
        pathname.startsWith("/trade/") &&
        pathname !== "/trade"
      ) {
        router.replace("/trade");
      }
      return;
    }

    if (!sessionState || pathname === "/trade") {
      return;
    }

    const verify = async () => {
      try {
        const response = await fetch(
          `/api/chat/history?sessionId=${sessionState}`,
          {
            headers: { "x-wallet-address": normalizedAddress }
          }
        );

        if (response.status === 403 || response.status === 404) {
          router.replace("/trade");
        }
      } catch (error) {
        console.error("[CLIENT] Failed to verify session access:", error);
      }
    };

    void verify();
  }, [normalizedAddress, pathname, router, sessionState, setMessages]);

  type ChatMessage = (typeof messages)[number];

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastProcessedUserMessageId = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionState) {
      historyLoadedRef.current = null;
      setMessages([]);
      setIsHistoryLoading(false);
      lastSessionRef.current = null;
      return;
    }

    const historyKey = `${sessionState}:${normalizedAddress ?? "anon"}`;
    if (historyLoadedRef.current === historyKey) {
      return;
    }

    if (!initialSessionIdRef.current) {
      historyLoadedRef.current = historyKey;
      lastSessionRef.current = sessionState;
      return;
    }

    let isCancelled = false;

    const loadHistory = async () => {
      setIsHistoryLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (normalizedAddress) {
          headers["x-wallet-address"] = normalizedAddress;
        }

        const response = await fetch(
          `/api/chat/history?sessionId=${sessionState}`,
          {
            headers
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to fetch history");
        }

        const data = (await response.json()) as { messages: ChatMessage[] };

        if (!isCancelled) {
          skipNextDispatchRef.current = true;
          setMessages(data.messages);
          historyLoadedRef.current = historyKey;
          lastSessionRef.current = sessionState;
        }
      } catch (historyError) {
        if (!isCancelled) {
          console.error("[CLIENT] Failed to load chat history:", historyError);
          setMessages([]);
        }
      } finally {
        if (!isCancelled) {
          setIsHistoryLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      isCancelled = true;
    };
  }, [normalizedAddress, sessionState, setMessages]);

  useEffect(() => {
    const sessionChanged =
      lastSessionRef.current &&
      sessionState &&
      lastSessionRef.current !== sessionState;

    if (sessionChanged) {
      setMessages([]);
      historyLoadedRef.current = null;
      lastDispatchCountRef.current = 0;
      skipNextDispatchRef.current = false;
    }

    if (sessionState) {
      lastSessionRef.current = sessionState;
    }
  }, [sessionState, setMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleCopyMessage = useCallback(async (message: ChatMessage) => {
    const text = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim();

    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(message.id);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedMessageId(null);
      }, 1200);
    } catch (copyError) {
      console.error("[CLIENT] Failed to copy message:", copyError);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
    if (inputRef.current && address && status !== "streaming") {
      inputRef.current.focus();
    }
  }, [messages, address, status]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Find the most recent user-authored message
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message.role === "user") {
        if (message.id !== lastProcessedUserMessageId.current) {
          lastProcessedUserMessageId.current = message.id;
          // Any new user message should expire previously fetched quotes
          latestQuoteTimestamp = Date.now();
          notifyQuoteChange();
        }
        break;
      }
    }
  }, [messages]);

  useEffect(() => {
    if (!sessionState || messages.length === 0) {
      return;
    }

    if (skipNextDispatchRef.current) {
      skipNextDispatchRef.current = false;
      lastDispatchCountRef.current = messages.length;
      return;
    }

    if (lastDispatchCountRef.current === messages.length) {
      return;
    }

    lastDispatchCountRef.current = messages.length;
    window.dispatchEvent(
      new CustomEvent("chat-session-updated", {
        detail: { sessionId: sessionState }
      })
    );
  }, [messages, sessionState]);

  return (
    <div className="bg-black rounded-2xl shadow-2xl flex flex-col max-h-[80vh] min-h-[70vh] w-full px-4 sm:px-6 overflow-x-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-3 sm:py-6 overflow-x-hidden [scrollbar-gutter:stable_both-edges]">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          {isHistoryLoading && messages.length === 0 && (
            <div className="h-full flex items-center justify-center text-center">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Loading your conversation…</span>
              </div>
            </div>
          )}
          {!isHistoryLoading && messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-primary-600/20 flex items-center justify-center mb-3 sm:mb-4">
                <svg
                  className="w-6 h-6 sm:w-8 sm:h-8 text-primary-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-white mb-2">
                Start Trading
              </h3>
              <p className="text-xs sm:text-sm text-gray-400 mb-4 sm:mb-6 max-w-sm px-4 sm:px-0">
                Ask me anything about trading. Here are some examples:
              </p>
              <div className="space-y-2 text-xs sm:text-sm text-left max-w-md w-full px-2">
                <button
                  onClick={() => {
                    if (address) {
                      sendMessage({ text: "What's the price of ETH on Base?" });
                    }
                  }}
                  disabled={!address}
                  className="w-full glass rounded-lg px-3 sm:px-4 py-2 text-gray-300 hover:bg-white/10 transition-colors cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-50"
                >
                  What&apos;s the price of ETH on Base?
                </button>
                <button
                  onClick={() => {
                    if (address) {
                      sendMessage({
                        text: "Get me a quote for 100 USDC to DAI on Arbitrum"
                      });
                    }
                  }}
                  disabled={!address}
                  className="w-full glass rounded-lg px-3 sm:px-4 py-2 text-gray-300 hover:bg-white/10 transition-colors cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Get me a quote for 100 USDC to DAI on Arbitrum
                </button>
                <button
                  onClick={() => {
                    if (address) {
                      sendMessage({
                        text: "Show me the best rate for 0.5 ETH to USDT"
                      });
                    }
                  }}
                  disabled={!address}
                  className="w-full glass rounded-lg px-3 sm:px-4 py-2 text-gray-300 hover:bg-white/10 transition-colors cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Show me the best rate for 0.5 ETH to USDT
                </button>
                <button
                  onClick={() => {
                    if (address) {
                      sendMessage({
                        text: "What are the staking options for USDC on Base?"
                      });
                    }
                  }}
                  disabled={!address}
                  className="w-full glass rounded-lg px-3 sm:px-4 py-2 text-gray-300 hover:bg-white/10 transition-colors cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-50"
                >
                  What are the staking options for USDC on Base?
                </button>
                <button
                  onClick={() => {
                    if (address) {
                      sendMessage({
                        text: "Bridge 250 USDC from Arbitrum to Base"
                      });
                    }
                  }}
                  disabled={!address}
                  className="w-full glass rounded-lg px-3 sm:px-4 py-2 text-gray-300 hover:bg-white/10 transition-colors cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Bridge 250 USDC from Arbitrum to Base
                </button>
                <button
                  onClick={() => {
                    if (address) {
                      sendMessage({
                        text: "What's the price of ETH to USD on MegaETH?"
                      });
                    }
                  }}
                  disabled={!address}
                  className="w-full glass rounded-lg px-3 sm:px-4 py-2 text-gray-300 hover:bg-white/10 transition-colors cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-50"
                >
                  What&apos;s the price of ETH to USD on MegaETH?
                </button>
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
                className={`relative group max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 text-gray-200 bg-transparent`}
              >
                {message.role === "user" && (
                  <button
                    type="button"
                    onClick={() => handleCopyMessage(message)}
                    aria-label="Copy message"
                    className="absolute -right-3 -top-3 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white bg-black/70 border border-white/10 rounded-full p-1"
                  >
                    {copiedMessageId === message.id ? (
                      <CheckIcon className="w-3.5 h-3.5" />
                    ) : (
                      <CopyIcon className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
                <div className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">
                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      return <span key={index}>{part.text}</span>;
                    }
                    if (part.type.startsWith("tool-")) {
                      if ("state" in part) {
                        if (
                          part.state === "output-available" &&
                          "output" in part
                        ) {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const output = part.output as any;

                          // Check if this needs client-side balance fetch + quote
                          if (output?.needsClientBalanceFetch) {
                            return (
                              <EntireBalanceQuoteDisplay
                                key={index}
                                tokenInfo={output}
                                publicClient={publicClient}
                                walletClient={walletClient}
                                address={address}
                              />
                            );
                          }

                          // Check if this needs client-side quote fetching
                          if (output?.needsClientQuote) {
                            return (
                              <QuoteDisplay
                                key={index}
                                tokenInfo={output}
                                publicClient={publicClient}
                                walletClient={walletClient}
                                address={address}
                              />
                            );
                          }

                          const stakingInfo = output?.stakingOptions as
                            | MorphoStakingOption
                            | undefined;
                          if (stakingInfo?.needsClientStaking) {
                            return (
                              <MorphoStakingCard
                                key={index}
                                stakingInfo={stakingInfo}
                                publicClient={publicClient}
                                walletClient={walletClient}
                                address={address}
                              />
                            );
                          }

                          const bridgeQuote = output?.bridgeQuote as
                            | SerializedBridgeQuote
                            | undefined;
                          if (bridgeQuote?.needsClientBridge) {
                            return (
                              <BridgeQuoteCard
                                key={index}
                                bridgeQuote={bridgeQuote}
                                publicClient={publicClient}
                                walletClient={walletClient}
                                address={address}
                              />
                            );
                          }

                          // Check if this needs client-side order submission
                          if (output?.needsClientSubmission) {
                            return (
                              <OrderSubmit
                                key={index}
                                tokenInfo={output}
                                publicClient={publicClient}
                                walletClient={walletClient}
                                address={address}
                              />
                            );
                          }

                          // Wallet balances display
                          const isBalances =
                            output?.success &&
                            output?.balances &&
                            Array.isArray(output.balances);
                          if (isBalances) {
                            return (
                              <div
                                key={index}
                                className="mt-3 pt-3 border-t border-white/10"
                              >
                                <div className="glass-strong rounded-lg p-4">
                                  <div className="mb-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                      <span className="text-xs font-semibold text-emerald-400">
                                        Wallet Balances on {output.chain}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-400">
                                      Total: $
                                      {output.totalValue?.toFixed(2) || "0.00"}
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    {output.balances.map(
                                      (
                                        bal: {
                                          symbol: string;
                                          name: string;
                                          balance: string;
                                          usdValue?: number;
                                          logoUri?: string;
                                        },
                                        i: number
                                      ) => (
                                        <div
                                          key={i}
                                          className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                        >
                                          <div className="flex items-center gap-3 flex-1">
                                            {bal.logoUri ? (
                                              <img
                                                src={bal.logoUri}
                                                alt={bal.symbol}
                                                className="w-8 h-8 rounded-full"
                                                onError={(e) => {
                                                  const target = e.target as HTMLImageElement;
                                                  target.style.display = 'none';
                                                  const placeholder = target.nextElementSibling as HTMLElement;
                                                  if (placeholder) placeholder.style.display = 'flex';
                                                }}
                                              />
                                            ) : null}
                                            <div
                                              className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-xs font-bold"
                                              style={{ display: bal.logoUri ? 'none' : 'flex' }}
                                            >
                                              {bal.symbol.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                              <div className="text-sm font-semibold text-white">
                                                {bal.symbol}
                                              </div>
                                              <div className="text-xs text-gray-400">
                                                {bal.name}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <div className="text-sm font-semibold text-white">
                                              {parseFloat(bal.balance).toFixed(
                                                6
                                              )}
                                            </div>
                                            {bal.usdValue !== undefined && (
                                              <div className="text-xs text-gray-400">
                                                ${bal.usdValue.toFixed(2)}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    )}
                                  </div>
                                  {output.count > output.balances.length && (
                                    <div className="mt-3 pt-3 border-t border-white/10 text-xs text-gray-400 text-center">
                                      Showing top {output.balances.length} of{" "}
                                      {output.count} tokens
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          // Price display
                          const isPrice =
                            output?.success && output?.price && output?.message;
                          if (isPrice) {
                            return (
                              <div
                                key={index}
                                className="mt-3 pt-3 border-t border-white/10"
                              >
                                <div className="glass-strong rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    <span className="text-xs font-semibold text-blue-400">
                                      Current Price
                                    </span>
                                  </div>
                                  <div className="text-white font-semibold">
                                    {output.message}
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          // UNIVERSAL FALLBACK HANDLER
                          // CRITICAL ARCHITECTURAL DECISION:
                          // We CANNOT rely on AI to always generate text after tool calls.
                          // OpenAI GPT-4 frequently stops with finishReason: 'tool-calls' and text: ''
                          // Therefore, EVERY tool output with a 'message' or 'userMessage' field
                          // MUST be rendered client-side as a fallback.

                          // 1. Error handling (highest priority)
                          if (
                            output?.success === false &&
                            "userMessage" in output
                          ) {
                            return (
                              <div
                                key={index}
                                className="mt-3 pt-3 border-t border-white/10"
                              >
                                <div className="glass-strong rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                    <span className="text-xs font-semibold text-amber-400">
                                      Notice
                                    </span>
                                  </div>
                                  <div className="text-white text-sm">
                                    {output.userMessage}
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          // 2. Success messages with 'message' field
                          // This catches: singleTokenResponse, price responses, and any future tools
                          if (
                            output?.success === true &&
                            output?.message &&
                            typeof output.message === "string"
                          ) {
                            return (
                              <div
                                key={index}
                                className="mt-3 pt-3 border-t border-white/10"
                              >
                                <div className="glass-strong rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <span className="text-xs font-semibold text-emerald-400">
                                      Result
                                    </span>
                                  </div>
                                  <div className="text-white text-sm whitespace-pre-wrap">
                                    {output.message}
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return null;
                        }
                        if (
                          part.state === "input-streaming" ||
                          part.state === "streaming"
                        ) {
                          return (
                            <div
                              key={index}
                              className="mt-3 pt-3 border-t border-white/10"
                            >
                              <div className="text-xs flex items-center gap-2 text-primary-300">
                                <div className="w-3 h-3 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"></div>
                                <span>Processing...</span>
                              </div>
                            </div>
                          );
                        }
                      }
                    }
                    return null;
                  })}
                </div>
              </div>
            </div>
          ))}

          {status === "streaming" && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim() && address) {
            sendMessage({
              text: input
            });
            setInput("");
          }
        }}
        className="py-3 sm:py-4 flex-shrink-0 w-full"
      >
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-center gap-2 border-b border-white/10 focus-within:border-emerald-500/50 transition-colors">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                address
                  ? "Ask me to trade, stake, or bridge tokens..."
                  : "Connect your wallet to start trading, staking, or bridging"
              }
              disabled={!address || status === "streaming"}
              className="flex-1 px-2 sm:px-3 py-2 sm:py-3 bg-transparent focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-white placeholder:text-gray-500 text-sm sm:text-base caret-emerald-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || !address || status === "streaming"}
              className="p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed enabled:bg-emerald-600 enabled:hover:bg-emerald-500 text-white flex-shrink-0"
              aria-label="Send message"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 19V5" />
                <path d="M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
