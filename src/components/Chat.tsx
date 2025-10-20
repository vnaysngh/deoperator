"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DefaultChatTransport } from "ai";
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useBalance
} from "wagmi";
import {
  quoteAndSubmitSwap,
  getCowProtocolAllowance,
  approveCowProtocol
} from "@/lib/cowswap-client";
import {
  approveMorphoVault,
  depositIntoMorphoVault,
  getMorphoVaultAllowance
} from "@/lib/morpho-client";
import {
  deserializeBridgeDeposit,
  getAcrossClient,
  type SerializedBridgeQuote
} from "@/lib/across-client";
import { NATIVE_CURRENCY_ADDRESS } from "@/lib/native-currencies";
import { formatCompactNumber } from "@/lib/utils";
import type { Address, PublicClient, WalletClient } from "viem";
import { formatUnits, parseUnits } from "viem";
import { useRouter, usePathname } from "next/navigation";

// Global ref to track the latest quote timestamp and listeners
let latestQuoteTimestamp = 0;
const quoteListeners = new Set<() => void>();

function notifyQuoteChange() {
  quoteListeners.forEach((listener) => listener());
}

type MorphoStakingOption = {
  needsClientStaking: true;
  chainId: number;
  chainLabel: string;
  tokenSymbol: string;
  vaultAddress: Address;
  vaultName?: string;
  vaultSymbol?: string;
  assetAddress: Address;
  assetDecimals: number;
  apy: number | null;
  netApy: number | null;
  tvlUsd: number | null;
  totalAssets: string | null;
};

async function ensureClientsOnChain({
  targetChainId,
  address,
  publicClient,
  walletClient
}: {
  targetChainId: number;
  address?: Address;
  publicClient?: PublicClient;
  walletClient?: WalletClient;
}): Promise<{
  publicClient: PublicClient;
  walletClient: WalletClient;
}> {
  if (!address) {
    throw new Error("WALLET_NOT_CONNECTED");
  }

  const { wagmiAdapter } = await import("@/lib/wagmi");
  const { getWalletClient, getPublicClient } = await import("wagmi/actions");

  let resolvedWalletClient: WalletClient | undefined = walletClient;
  if (!resolvedWalletClient) {
    resolvedWalletClient = await getWalletClient(wagmiAdapter.wagmiConfig, {
      account: address,
      assertChainId: false
    });
  }

  if (!resolvedWalletClient) {
    throw new Error("WALLET_CLIENT_UNAVAILABLE");
  }

  if (resolvedWalletClient.chain?.id !== targetChainId) {
    try {
      const { switchChain } = await import("@wagmi/core");
      await switchChain(wagmiAdapter.wagmiConfig, {
        chainId: targetChainId
      });
      resolvedWalletClient = await getWalletClient(wagmiAdapter.wagmiConfig, {
        account: address,
        assertChainId: false
      });
    } catch (switchError) {
      if (
        switchError instanceof Error &&
        (switchError.name === "UserRejectedRequestError" ||
          switchError.message.toLowerCase().includes("user rejected"))
      ) {
        throw new Error("USER_REJECTED_SWITCH");
      }
      if (
        switchError instanceof Error &&
        switchError.name === "SwitchChainNotSupportedError"
      ) {
        throw new Error("SWITCH_NOT_SUPPORTED");
      }
      throw switchError instanceof Error
        ? switchError
        : new Error("SWITCH_FAILED");
    }
  }

  if (resolvedWalletClient.chain?.id !== targetChainId) {
    throw new Error("CHAIN_NOT_MATCHING");
  }

  let resolvedPublicClient: PublicClient | undefined = publicClient;
  if (
    !resolvedPublicClient ||
    resolvedPublicClient.chain?.id !== targetChainId
  ) {
    resolvedPublicClient = await getPublicClient(wagmiAdapter.wagmiConfig, {
      chainId: targetChainId
    });
  }

  if (!resolvedPublicClient) {
    throw new Error("PUBLIC_CLIENT_UNAVAILABLE");
  }

  return {
    publicClient: resolvedPublicClient,
    walletClient: resolvedWalletClient
  };
}

function describeSwitchError(
  error: unknown,
  chainLabel: string
): { message: string; manualSwitch: boolean } {
  if (error instanceof Error) {
    if (error.message === "WALLET_NOT_CONNECTED") {
      return {
        message: "Connect your wallet to continue.",
        manualSwitch: false
      };
    }

    if (error.message === "USER_REJECTED_SWITCH") {
      return {
        message: `Looks like you cancelled the network switch. Approve the request to continue on ${chainLabel}.`,
        manualSwitch: false
      };
    }

    if (error.message === "SWITCH_NOT_SUPPORTED") {
      return {
        message: `Your wallet can't change networks automatically. Please switch to ${chainLabel} in your wallet and try again.`,
        manualSwitch: true
      };
    }

    if (error.message === "CHAIN_NOT_MATCHING") {
      return {
        message: `We couldn't confirm the network change. Switch to ${chainLabel} manually and try once more.`,
        manualSwitch: true
      };
    }

    if (error.message === "WALLET_CLIENT_UNAVAILABLE") {
      return {
        message:
          "I couldn't reach your wallet. Try reconnecting it and then retry.",
        manualSwitch: false
      };
    }

    if (error.message === "PUBLIC_CLIENT_UNAVAILABLE") {
      return {
        message:
          "Unable to reach the selected network right now. Please try again shortly.",
        manualSwitch: false
      };
    }

    return {
      message: error.message,
      manualSwitch: true
    };
  }

  return {
    message:
      "We couldn't prepare your wallet for this network. Switch networks manually and try again.",
    manualSwitch: true
  };
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
          if (responseSessionId && sessionStateRef.current !== responseSessionId) {
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
        const response = await fetch(`/api/chat/history?sessionId=${sessionState}`, {
          headers: { "x-wallet-address": normalizedAddress }
        });

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
                                      },
                                      i: number
                                    ) => (
                                      <div
                                        key={i}
                                        className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                      >
                                        <div className="flex-1">
                                          <div className="text-sm font-semibold text-white">
                                            {bal.symbol}
                                          </div>
                                          <div className="text-xs text-gray-400">
                                            {bal.name}
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-sm font-semibold text-white">
                                            {parseFloat(bal.balance).toFixed(6)}
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

function CopyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="7" y="7" width="9" height="9" rx="2" />
      <path d="M4 13V5a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M16 6 8.5 13.5 5 10" />
    </svg>
  );
}

/**
 * Component that fetches user's entire balance and then displays quote
 * Used for "swap my whole balance" requests
 */
function EntireBalanceQuoteDisplay({
  tokenInfo,
  publicClient,
  walletClient,
  address
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokenInfo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletClient: any;
  address?: Address;
}) {
  const isNativeCurrencyTrade =
    tokenInfo.isNativeCurrency ||
    (typeof tokenInfo.fromTokenAddress === "string" &&
      tokenInfo.fromTokenAddress.toLowerCase() ===
        NATIVE_CURRENCY_ADDRESS.toLowerCase());

  // Fetch balance using wagmi
  const { data: balance, isLoading: balanceLoading } = useBalance({
    address: address,
    token: isNativeCurrencyTrade
      ? undefined
      : (tokenInfo.fromTokenAddress as Address),
    chainId: tokenInfo.chainId
  });

  if (balanceLoading) {
    return (
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="text-xs flex items-center gap-2 text-primary-300">
          <div className="w-3 h-3 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"></div>
          <span>Checking {tokenInfo.fromToken} balance...</span>
        </div>
      </div>
    );
  }

  // Check if balance is zero or undefined
  if (!balance || balance.value === BigInt(0)) {
    return (
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="glass-strong rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <span className="text-xs font-semibold text-amber-400">Notice</span>
          </div>
          <div className="text-white text-sm">
            You don&apos;t have any {tokenInfo.fromToken} to swap on{" "}
            {tokenInfo.chain}.
          </div>
        </div>
      </div>
    );
  }

  // Convert balance to human-readable format
  const balanceAmount = formatUnits(balance.value, balance.decimals);

  // Create updated tokenInfo with the actual balance
  const updatedTokenInfo = {
    ...tokenInfo,
    amount: balanceAmount,
    needsClientBalanceFetch: false // Already fetched
  };

  // Now render the normal QuoteDisplay with the balance
  return (
    <>
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="text-sm text-gray-300">
          Your {tokenInfo.fromToken} balance:{" "}
          {parseFloat(balanceAmount).toFixed(6)} {tokenInfo.fromToken}
        </div>
      </div>
      <QuoteDisplay
        tokenInfo={updatedTokenInfo}
        publicClient={publicClient}
        walletClient={walletClient}
        address={address}
      />
    </>
  );
}

function BridgeQuoteCard({
  bridgeQuote,
  publicClient,
  walletClient,
  address
}: {
  bridgeQuote: SerializedBridgeQuote;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletClient: any;
  address?: Address;
}) {
  const [status, setStatus] = useState<
    | "idle"
    | "preparing"
    | "approving"
    | "depositing"
    | "waiting-fill"
    | "success"
    | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [depositId, setDepositId] = useState<string | null>(null);
  const [depositTxHash, setDepositTxHash] = useState<string | null>(null);
  const [fillTxHash, setFillTxHash] = useState<string | null>(null);

  const {
    data: balance,
    isLoading: balanceLoading,
    refetch
  } = useBalance({
    address,
    chainId: bridgeQuote.originChainId,
    token: bridgeQuote.isNative
      ? undefined
      : (bridgeQuote.tokenAddress as Address)
  });

  const inputAmount = useMemo(
    () => BigInt(bridgeQuote.inputAmountWei),
    [bridgeQuote.inputAmountWei]
  );

  const hasEnoughBalance = useMemo(() => {
    if (!balance) {
      return null;
    }
    return balance.value >= inputAmount;
  }, [balance, inputAmount]);

  const isProcessing =
    status === "preparing" ||
    status === "approving" ||
    status === "depositing" ||
    status === "waiting-fill";

  const buttonLabel = useMemo(() => {
    switch (status) {
      case "preparing":
        return "Switching...";
      case "approving":
        return "Approve in wallet...";
      case "depositing":
        return "Confirm deposit...";
      case "waiting-fill":
        return "Waiting for fill...";
      case "success":
        return "Bridge again";
      case "error":
        return "Try again";
      default:
        return "Bridge";
    }
  }, [status]);

  const feeSummary = useMemo(() => {
    const formatPercent = (value: number) =>
      Number.isFinite(value) ? `${value.toFixed(3)}%` : "—";

    return [
      {
        label: "Total fee",
        value: `${bridgeQuote.totalFee.amountFormatted} ${bridgeQuote.tokenSymbol}`,
        percent: formatPercent(bridgeQuote.totalFee.percentage)
      },
      {
        label: "Relayer gas",
        value: `${bridgeQuote.relayerGasFee.amountFormatted} ${bridgeQuote.tokenSymbol}`,
        percent: formatPercent(bridgeQuote.relayerGasFee.percentage)
      },
      {
        label: "Relayer capital",
        value: `${bridgeQuote.relayerCapitalFee.amountFormatted} ${bridgeQuote.tokenSymbol}`,
        percent: formatPercent(bridgeQuote.relayerCapitalFee.percentage)
      },
      {
        label: "LP fee",
        value: `${bridgeQuote.lpFee.amountFormatted} ${bridgeQuote.tokenSymbol}`,
        percent: formatPercent(bridgeQuote.lpFee.percentage)
      }
    ];
  }, [bridgeQuote]);

  const handleBridge = useCallback(async () => {
    if (!address) {
      setErrorMessage("Connect your wallet to bridge.");
      return;
    }

    if (hasEnoughBalance === false) {
      setErrorMessage(
        `You don't have enough ${bridgeQuote.tokenSymbol} on ${bridgeQuote.originChainLabel} to bridge that amount.`
      );
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setDepositId(null);
    setDepositTxHash(null);
    setFillTxHash(null);

    let preparedClients: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      publicClient: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      walletClient: any;
    };

    try {
      setStatus("preparing");
      setStatusMessage(`Switching to ${bridgeQuote.originChainLabel}...`);
      preparedClients = await ensureClientsOnChain({
        targetChainId: bridgeQuote.originChainId,
        address,
        publicClient,
        walletClient
      });
      await refetch?.();
    } catch (switchError) {
      const { message } = describeSwitchError(
        switchError,
        bridgeQuote.originChainLabel
      );
      setStatus("error");
      setStatusMessage(null);
      setErrorMessage(message);
      return;
    }

    try {
      const acrossClient = getAcrossClient();
      acrossClient.update({
        walletClient: preparedClients.walletClient
      });

      const deposit = deserializeBridgeDeposit(bridgeQuote.deposit);
      const destinationClient = acrossClient.getPublicClient(
        bridgeQuote.destinationChainId
      );

      setStatus("approving");
      setStatusMessage("Checking allowance...");

      await acrossClient.executeQuote({
        deposit,
        walletClient: preparedClients.walletClient,
        originClient: preparedClients.publicClient,
        destinationClient,
        onProgress: (progress) => {
          if (
            progress.status === "error" ||
            progress.status === "simulationError" ||
            progress.status === "txError"
          ) {
            setStatus("error");
            setStatusMessage(null);
            setErrorMessage(
              progress.error?.message ||
                "Bridge transaction failed. Please try again."
            );
            return;
          }

          if (progress.step === "approve") {
            if (progress.status === "txPending") {
              setStatus("approving");
              setStatusMessage("Approval pending in your wallet...");
            }
            if (progress.status === "txSuccess") {
              setStatusMessage("Approval confirmed. Preparing deposit...");
            }
          }

          if (progress.step === "deposit") {
            if (progress.status === "simulationPending") {
              setStatus("depositing");
              setStatusMessage("Simulating deposit...");
            }
            if (progress.status === "txPending") {
              setStatus("depositing");
              setStatusMessage(
                "Deposit submitted. Waiting for confirmation..."
              );
              if (progress.txHash) {
                setDepositTxHash(progress.txHash);
              }
            }
            if (progress.status === "txSuccess") {
              setStatus("waiting-fill");
              setStatusMessage(
                "Deposit confirmed! Waiting for the relayer to fill on the destination chain..."
              );
              if (progress.depositId) {
                setDepositId(progress.depositId.toString());
              }
              if (progress.txReceipt?.transactionHash) {
                setDepositTxHash(progress.txReceipt.transactionHash);
              }
            }
          }

          if (progress.step === "fill") {
            if (progress.status === "txPending") {
              setStatus("waiting-fill");
              setStatusMessage(
                "Fill transaction pending on the destination chain..."
              );
            }
            if (progress.status === "txSuccess") {
              setStatus("success");
              setStatusMessage(
                "Bridge filled! Funds are available on the destination chain."
              );
              if (progress.txReceipt?.transactionHash) {
                setFillTxHash(progress.txReceipt.transactionHash);
              }
            }
          }
        }
      });
    } catch (err) {
      console.error("[CLIENT] Across bridge error:", err);
      setStatus("error");
      setStatusMessage(null);

      if (err instanceof Error) {
        const lower = err.message.toLowerCase();
        if (lower.includes("user rejected")) {
          setErrorMessage(
            "Looks like the transaction was rejected. Approve it in your wallet to bridge."
          );
          return;
        }
        setErrorMessage(err.message);
        return;
      }

      setErrorMessage("Bridge failed. Please try again.");
    }
  }, [
    address,
    bridgeQuote,
    publicClient,
    walletClient,
    hasEnoughBalance,
    refetch
  ]);

  const minDepositNotice =
    bridgeQuote.limits.minDepositWei !== "0"
      ? bridgeQuote.limits.minDepositFormatted
      : null;

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      <div className="glass-strong rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-primary-300">
              <span className="inline-flex h-2 w-2 rounded-full bg-primary-400"></span>
              Across Bridge
            </div>
            <div className="text-lg font-semibold text-white mt-1">
              {bridgeQuote.requestedAmount} {bridgeQuote.tokenSymbol}
            </div>
            <div className="text-xs text-gray-400">
              {bridgeQuote.originChainLabel} →{" "}
              {bridgeQuote.destinationChainLabel}
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <div>
              <div className="text-gray-400 text-xs uppercase">You send</div>
              <div className="text-white font-semibold">
                {bridgeQuote.inputAmountFormatted} {bridgeQuote.tokenSymbol}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-xs uppercase">You receive</div>
              <div className="text-white font-semibold">
                {bridgeQuote.outputAmountFormatted} {bridgeQuote.tokenSymbol}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-xs uppercase">ETA</div>
              <div className="text-white font-semibold">
                {bridgeQuote.estimatedFillTimeFormatted}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-black/30 rounded-xl border border-white/10 p-3 space-y-3">
          <div className="text-xs text-gray-300 font-medium">Fee breakdown</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {feeSummary.map((fee) => (
              <div
                key={fee.label}
                className="flex items-center justify-between text-xs text-gray-400"
              >
                <span>{fee.label}</span>
                <span className="text-gray-200">
                  {fee.value}
                  <span className="text-gray-500"> ({fee.percent})</span>
                </span>
              </div>
            ))}
          </div>
          {minDepositNotice && (
            <div className="text-xs text-gray-400">
              Minimum deposit for this lane: {minDepositNotice}{" "}
              {bridgeQuote.tokenSymbol}
            </div>
          )}
          {hasEnoughBalance === false && (
            <div className="text-xs text-red-400">
              Insufficient {bridgeQuote.tokenSymbol} balance. You need{" "}
              {bridgeQuote.inputAmountFormatted} {bridgeQuote.tokenSymbol} but
              only have{" "}
              {balance
                ? `${Number(
                    formatUnits(balance.value, balance.decimals)
                  ).toLocaleString(undefined, {
                    maximumFractionDigits: 6
                  })} ${bridgeQuote.tokenSymbol}`
                : `0 ${bridgeQuote.tokenSymbol}`}
              .
            </div>
          )}
          {bridgeQuote.isAmountTooLow && hasEnoughBalance !== false && (
            <div className="text-xs text-amber-400">
              This amount is near the minimum. Larger deposits may settle
              faster.
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleBridge}
            disabled={
              !address ||
              isProcessing ||
              balanceLoading ||
              hasEnoughBalance === false
            }
            className="w-full px-4 py-3 rounded-lg font-semibold text-sm transition-all bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
          >
            {buttonLabel}
          </button>
          {balanceLoading && (
            <div className="text-xs text-primary-300">Checking balance...</div>
          )}
          {statusMessage && (
            <div className="text-xs text-primary-300">{statusMessage}</div>
          )}
          {errorMessage && (
            <div className="text-xs text-red-400">{errorMessage}</div>
          )}
          {depositId && (
            <div className="text-xs text-gray-400">
              Deposit ID: <span className="font-mono">{depositId}</span>
            </div>
          )}
          {depositTxHash && (
            <div className="text-xs text-gray-400">
              Deposit tx hash:{" "}
              <span className="font-mono">
                {depositTxHash.slice(0, 6)}…{depositTxHash.slice(-4)}
              </span>
            </div>
          )}
          {fillTxHash && (
            <div className="text-xs text-gray-400">
              Fill tx hash:{" "}
              <span className="font-mono">
                {fillTxHash.slice(0, 6)}…{fillTxHash.slice(-4)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MorphoStakingCard({
  stakingInfo,
  publicClient,
  walletClient,
  address
}: {
  stakingInfo: MorphoStakingOption;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletClient: any;
  address?: Address;
}) {
  const [amount, setAmount] = useState("");
  const [actionState, setActionState] = useState<
    "idle" | "checking-allowance" | "approval" | "staking" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  const walletChainId = walletClient?.chain?.id;
  const chainMismatch =
    walletChainId !== undefined && walletChainId !== stakingInfo.chainId;

  const explorerBaseUrl = useMemo(() => {
    switch (stakingInfo.chainId) {
      case 1:
        return "https://etherscan.io/tx/";
      case 42161:
        return "https://arbiscan.io/tx/";
      case 8453:
        return "https://basescan.org/tx/";
      default:
        return null;
    }
  }, [stakingInfo.chainId]);

  const {
    data: balance,
    isLoading: balanceLoading,
    refetch
  } = useBalance({
    address,
    chainId: stakingInfo.chainId,
    token: stakingInfo.assetAddress
  });

  const apyDisplay =
    stakingInfo.netApy !== null && stakingInfo.netApy !== undefined
      ? (stakingInfo.netApy * 100).toFixed(2)
      : stakingInfo.apy !== null && stakingInfo.apy !== undefined
      ? (stakingInfo.apy * 100).toFixed(2)
      : null;

  const totalAssetsNumber =
    stakingInfo.totalAssets && stakingInfo.assetDecimals !== undefined
      ? Number.parseFloat(
          formatUnits(
            BigInt(stakingInfo.totalAssets),
            stakingInfo.assetDecimals
          )
        )
      : null;

  const totalAssetsCompact =
    totalAssetsNumber !== null && Number.isFinite(totalAssetsNumber)
      ? formatCompactNumber(totalAssetsNumber, { fullDigits: 2 })
      : null;

  const tvlCompact =
    stakingInfo.tvlUsd !== null && stakingInfo.tvlUsd !== undefined
      ? formatCompactNumber(stakingInfo.tvlUsd, { fullDigits: 0 })
      : null;

  const balanceDisplay = balance
    ? `${parseFloat(balance.formatted).toLocaleString(undefined, {
        maximumFractionDigits:
          stakingInfo.assetDecimals > 6 ? 6 : stakingInfo.assetDecimals
      })} ${stakingInfo.tokenSymbol}`
    : `0 ${stakingInfo.tokenSymbol}`;

  const parsedAmount = (() => {
    if (!amount) return null;
    try {
      return parseUnits(amount, stakingInfo.assetDecimals);
    } catch {
      return null;
    }
  })();

  const isAmountValid =
    parsedAmount !== null &&
    parsedAmount > BigInt(0) &&
    !Number.isNaN(Number(amount));
  const hasSufficientBalance =
    parsedAmount !== null && balance ? balance.value >= parsedAmount : false;

  const stakeDisabled =
    !address ||
    !isAmountValid ||
    !hasSufficientBalance ||
    balanceLoading ||
    actionState === "checking-allowance" ||
    actionState === "approval" ||
    actionState === "staking";

  const liquidityLabel = (() => {
    if (totalAssetsCompact && tvlCompact) {
      return `≈${totalAssetsCompact.short} ${stakingInfo.tokenSymbol} ($${tvlCompact.short})`;
    }
    if (totalAssetsCompact) {
      return `≈${totalAssetsCompact.short} ${stakingInfo.tokenSymbol}`;
    }
    if (tvlCompact) {
      return `≈$${tvlCompact.short}`;
    }
    return "Unknown";
  })();

  const liquidityTitle = (() => {
    if (totalAssetsCompact && tvlCompact) {
      return `${totalAssetsCompact.full} ${stakingInfo.tokenSymbol} • $${tvlCompact.full}`;
    }
    if (totalAssetsCompact) {
      return `${totalAssetsCompact.full} ${stakingInfo.tokenSymbol}`;
    }
    if (tvlCompact) {
      return `$${tvlCompact.full}`;
    }
    return "Liquidity unavailable";
  })();

  const handleMax = () => {
    if (balance) {
      setAmount(balance.formatted);
    }
  };

  const handleStake = async () => {
    setErrorMessage(null);
    setTransactionHash(null);

    if (!address) {
      setErrorMessage("Connect your wallet to proceed.");
      return;
    }

    if (!parsedAmount || parsedAmount <= BigInt(0)) {
      setErrorMessage("Enter a valid amount to stake.");
      return;
    }

    if (!hasSufficientBalance) {
      setErrorMessage(
        `You don't have enough ${stakingInfo.tokenSymbol} to stake that amount.`
      );
      return;
    }

    setActionState("checking-allowance");

    let activePublicClient;
    let activeWalletClient;

    try {
      const clients = await ensureClientsOnChain({
        targetChainId: stakingInfo.chainId,
        address,
        publicClient,
        walletClient
      });

      activePublicClient = clients.publicClient;
      activeWalletClient = clients.walletClient;
    } catch (err) {
      console.error("[CLIENT] Morpho staking network preparation error:", err);
      const { message } = describeSwitchError(err, stakingInfo.chainLabel);
      setActionState("error");
      setErrorMessage(message);
      return;
    }

    try {
      await refetch?.();

      const ownerAddress = address as Address;

      const allowance = await getMorphoVaultAllowance(activePublicClient, {
        assetAddress: stakingInfo.assetAddress,
        owner: ownerAddress,
        vaultAddress: stakingInfo.vaultAddress
      });

      if (allowance < parsedAmount) {
        setActionState("approval");
        const approvalHash = await approveMorphoVault(activeWalletClient, {
          assetAddress: stakingInfo.assetAddress,
          owner: ownerAddress,
          vaultAddress: stakingInfo.vaultAddress,
          amount: parsedAmount
        });

        await activePublicClient.waitForTransactionReceipt({
          hash: approvalHash
        });
      }

      setActionState("staking");
      const stakeHash = await depositIntoMorphoVault(activeWalletClient, {
        vaultAddress: stakingInfo.vaultAddress,
        owner: ownerAddress,
        assets: parsedAmount,
        receiver: ownerAddress
      });

      setTransactionHash(stakeHash);

      await activePublicClient.waitForTransactionReceipt({
        hash: stakeHash
      });

      await refetch?.();

      setActionState("success");
      setAmount("");
      setErrorMessage(null);
    } catch (err) {
      console.error("[CLIENT] Morpho staking error:", err);
      setActionState("error");
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Something went wrong while staking."
      );
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      <div className="glass-strong rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-primary-300">
              <span className="inline-flex h-2 w-2 rounded-full bg-primary-400"></span>
              Morpho Staking
            </div>
            <div className="text-lg font-semibold text-white mt-1">
              {stakingInfo.tokenSymbol} on {stakingInfo.chainLabel}
            </div>
            <div className="text-xs text-gray-400">
              Vault address:{" "}
              <span className="font-mono text-[11px] text-gray-300">
                {stakingInfo.vaultAddress.slice(0, 6)}…
                {stakingInfo.vaultAddress.slice(-4)}
              </span>
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <div>
              <div className="text-gray-400 text-xs uppercase">Net APY</div>
              <div className="text-white font-semibold">
                {apyDisplay ? `${apyDisplay}%` : "Unknown"}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-xs uppercase">Liquidity</div>
              <div className="text-white font-semibold">
                <span title={liquidityTitle}>{liquidityLabel}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-black/30 rounded-xl border border-white/10 p-3 space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Available balance</span>
            <span>{balanceLoading ? "Checking..." : balanceDisplay}</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setErrorMessage(null);
                if (actionState === "success" || actionState === "error") {
                  setActionState("idle");
                }
              }}
              placeholder={`Amount of ${stakingInfo.tokenSymbol} to stake`}
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500/60"
            />
            <button
              type="button"
              onClick={handleMax}
              className="px-3 py-2 text-xs border border-white/10 rounded-lg text-gray-300 hover:bg-white/10 transition-colors"
              disabled={!balance || balance.value === BigInt(0)}
            >
              Max
            </button>
            <button
              type="button"
              onClick={handleStake}
              disabled={stakeDisabled}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {actionState === "checking-allowance"
                ? "Checking..."
                : actionState === "approval"
                ? "Approving..."
                : actionState === "staking"
                ? "Staking..."
                : actionState === "success"
                ? "Staked"
                : "Stake"}
            </button>
          </div>

          {chainMismatch && (
            <div className="text-xs text-amber-400">
              We&apos;ll prompt your wallet to switch to{" "}
              {stakingInfo.chainLabel} when you stake. If nothing pops up,
              change networks manually.
            </div>
          )}
          {!hasSufficientBalance && isAmountValid && !balanceLoading && (
            <div className="text-xs text-amber-400">
              Insufficient {stakingInfo.tokenSymbol} balance for this stake.
            </div>
          )}
          {!isAmountValid && amount && (
            <div className="text-xs text-amber-400">
              Enter a valid amount using numbers and decimals only.
            </div>
          )}
          {errorMessage && (
            <div className="text-xs text-red-400">{errorMessage}</div>
          )}
          {transactionHash && (
            <div className="text-xs text-emerald-400">
              Stake transaction:{" "}
              {explorerBaseUrl ? (
                <a
                  href={`${explorerBaseUrl}${transactionHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono underline-offset-2 hover:underline"
                >
                  {transactionHash.slice(0, 6)}…{transactionHash.slice(-4)}
                </a>
              ) : (
                <span className="font-mono">
                  {transactionHash.slice(0, 6)}…{transactionHash.slice(-4)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="text-[11px] text-gray-500">
          Powered by Morpho. Approvals and staking transactions will use your
          connected wallet.
        </div>
      </div>
    </div>
  );
}

/**
 * Component that fetches and displays quote using client-side Trading SDK
 */
function QuoteDisplay({
  tokenInfo,
  publicClient,
  walletClient,
  address
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokenInfo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletClient: any;
  address?: Address;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [orderInProgress, setOrderInProgress] = useState(false);
  const [orderCompleted, setOrderCompleted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const {
    amount,
    chainId,
    fromTokenAddress,
    fromTokenDecimals,
    toTokenAddress,
    toTokenDecimals
  } = tokenInfo;

  // Generate unique timestamp for this quote instance
  const [quoteTimestamp] = useState(() => Date.now());

  // Force re-render when global latestQuoteTimestamp changes
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const listener = () => forceUpdate({});
    quoteListeners.add(listener);
    return () => {
      quoteListeners.delete(listener);
    };
  }, []);

  const isLatestQuote =
    latestQuoteTimestamp === 0 || quoteTimestamp === latestQuoteTimestamp;

  useEffect(() => {
    if (!isLatestQuote) {
      setIsCollapsed(true);
    } else {
      setIsCollapsed(false);
    }
  }, [isLatestQuote]);

  const fetchQuote = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!address) {
      setError("Please connect your wallet");
      setLoading(false);
      return;
    }

    let activePublicClient = publicClient;
    if (
      !activePublicClient ||
      (activePublicClient.chain && activePublicClient.chain.id !== chainId)
    ) {
      try {
        const { getPublicClient } = await import("wagmi/actions");
        const { wagmiAdapter } = await import("@/lib/wagmi");
        activePublicClient = await getPublicClient(wagmiAdapter.wagmiConfig, {
          chainId
        });
      } catch (publicClientError) {
        console.error(
          "[CLIENT] Unable to resolve public client:",
          publicClientError
        );
      }
    }

    if (!activePublicClient) {
      setError(
        "Unable to reach the selected network right now. Please try again in a moment."
      );
      setLoading(false);
      return;
    }

    let activeWalletClient = walletClient;

    if (!activeWalletClient) {
      try {
        const { getWalletClient } = await import("wagmi/actions");
        const { wagmiAdapter } = await import("@/lib/wagmi");
        activeWalletClient = await getWalletClient(wagmiAdapter.wagmiConfig, {
          account: address,
          assertChainId: false
        });
      } catch (walletClientError) {
        console.error(
          "[CLIENT] Unable to resolve wallet client:",
          walletClientError
        );
      }
    }

    if (!activeWalletClient) {
      // Wallet is still initialising; keep spinner active so effect retries when client arrives.
      return;
    }

    try {
      console.log("[CLIENT] Fetching quote with Trading SDK...");

      // Import and use the client SDK
      const { getSwapQuote } = await import("@/lib/cowswap-client");

      const quoteResponse = await getSwapQuote(
        activePublicClient,
        activeWalletClient,
        {
          sellToken: fromTokenAddress as Address,
          sellTokenDecimals: fromTokenDecimals,
          buyToken: toTokenAddress as Address,
          buyTokenDecimals: toTokenDecimals,
          amount: parseUnits(amount.toString(), fromTokenDecimals).toString(),
          userAddress: address,
          chainId
        }
      );

      if (!quoteResponse || !quoteResponse.quoteResults) {
        setError(
          "Unable to get a quote for this trade. This might be due to insufficient liquidity or the trade amount being too small."
        );
        setLoading(false);
        return;
      }

      console.log("[CLIENT] CowSwap quote payload", {
        partnerFee: quoteResponse.quoteResults?.tradeParameters?.partnerFee,
        networkFee:
          quoteResponse.quoteResults?.amountsAndCosts?.costs?.networkFee,
        amountsAndCosts: quoteResponse.quoteResults?.amountsAndCosts
      });

      const { amountsAndCosts } = quoteResponse.quoteResults;

      if (
        !amountsAndCosts ||
        !amountsAndCosts.beforeNetworkCosts ||
        !amountsAndCosts.afterNetworkCosts ||
        !amountsAndCosts.costs ||
        !amountsAndCosts.costs.networkFee
      ) {
        setError(
          "Unable to get a quote for this trade. Try using a smaller amount or different tokens."
        );
        setLoading(false);
        return;
      }

      const buyAmountBeforeFees = amountsAndCosts.beforeNetworkCosts.buyAmount;
      const buyAmountAfterNetworkCosts =
        amountsAndCosts.afterNetworkCosts.buyAmount;
      const networkFeeInSellToken =
        amountsAndCosts.costs.networkFee.amountInSellCurrency;

      const formatQuoteAmount = (value: bigint | string, decimals: number) => {
        const normalized = formatUnits(BigInt(value), decimals);
        return Number(normalized).toFixed(6);
      };

      const slippageBps =
        quoteResponse.quoteResults.tradeParameters?.slippageBps ??
        quoteResponse.quoteResults.suggestedSlippageBps ??
        50;
      const slippagePercent = (Number(slippageBps) / 100).toFixed(2);

      setQuote({
        buyAmount: formatQuoteAmount(buyAmountBeforeFees, toTokenDecimals),
        buyAmountAfterFees: formatQuoteAmount(
          buyAmountAfterNetworkCosts,
          toTokenDecimals
        ),
        feeAmount: formatQuoteAmount(networkFeeInSellToken, fromTokenDecimals),
        slippagePercent,
        postSwapOrderFromQuote: quoteResponse.postSwapOrderFromQuote
      });
      setLoading(false);
      setCountdown(30);

      if (quoteTimestamp >= latestQuoteTimestamp) {
        latestQuoteTimestamp = quoteTimestamp;
        notifyQuoteChange();
      }
    } catch (err) {
      console.error("[CLIENT] Quote fetch error:", err);

      const errorMessage = err instanceof Error ? err.message : String(err);

      if (errorMessage.toLowerCase().includes("liquidity")) {
        setError(
          "Insufficient liquidity for this trade. Try using a smaller amount or different tokens."
        );
      } else if (errorMessage.toLowerCase().includes("slippage")) {
        setError(
          "Price slippage too high for this trade. Try adjusting the amount or try again later."
        );
      } else if (
        errorMessage.includes("NEXT_PUBLIC_COWSWAP_PARTNER_FEE_RECIPIENT")
      ) {
        setError(
          "Swap configuration missing partner fee recipient. Please contact support."
        );
      } else {
        setError(
          "Unable to get a quote for this trade. Please try again or use different tokens."
        );
      }

      setLoading(false);
    }
  }, [
    address,
    amount,
    chainId,
    fromTokenDecimals,
    fromTokenAddress,
    publicClient,
    quoteTimestamp,
    toTokenDecimals,
    toTokenAddress,
    walletClient
  ]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  // Countdown timer with auto-refresh
  useEffect(() => {
    if (
      loading ||
      error ||
      !quote ||
      !isLatestQuote ||
      orderInProgress ||
      orderCompleted
    )
      return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (quoteTimestamp === latestQuoteTimestamp) {
            fetchQuote();
          }
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [
    fetchQuote,
    loading,
    error,
    quote,
    orderInProgress,
    orderCompleted,
    quoteTimestamp,
    isLatestQuote
  ]);

  if (loading) {
    return (
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="text-xs flex items-center gap-2 text-primary-300">
          <div className="w-3 h-3 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"></div>
          <span>Fetching quote...</span>
        </div>
      </div>
    );
  }

  // Show error message to user if quote fetch failed
  if (error) {
    return (
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="glass-strong rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <span className="text-xs font-semibold text-red-400">
              Quote Error
            </span>
          </div>
          <div className="text-white text-sm mb-3">{error}</div>
          <button
            onClick={fetchQuote}
            className="w-full px-4 py-2 rounded-lg font-semibold text-sm bg-primary-600 hover:bg-primary-500 text-white transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      <div className="glass-strong rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-xs font-semibold text-emerald-400">
              Live Swap Quote
            </span>
          </div>
          <div className="flex items-center gap-2">
            {tokenInfo.chain && (
              <span className="text-xs px-2 py-1 glass rounded-md text-gray-400">
                {tokenInfo.chain}
              </span>
            )}
            {isLatestQuote && (
              <span className="text-xs px-2 py-1 glass rounded-md text-gray-400 cursor-help relative group/timer">
                {countdown}s
                <span className="invisible group-hover/timer:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded-md whitespace-nowrap z-10 pointer-events-none">
                  Quote refreshes in {countdown} seconds
                  <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-4 border-transparent border-t-gray-900"></span>
                </span>
              </span>
            )}
            {!isLatestQuote && (
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 bg-amber-500/20 rounded-md text-amber-400">
                  Expired
                </span>
                <button
                  type="button"
                  onClick={() => setIsCollapsed((prev) => !prev)}
                  className="text-xs text-gray-400 hover:text-gray-200 transition-colors underline-offset-2"
                >
                  {isCollapsed ? "Show details" : "Hide details"}
                </button>
              </div>
            )}
          </div>
        </div>
        {isCollapsed ? (
          <div className="pt-1 text-xs text-gray-400 border-t border-white/5">
            {tokenInfo.amount} {tokenInfo.fromToken} → {quote.buyAmount}{" "}
            {tokenInfo.toToken}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-500 text-xs">From</div>
                <div className="text-white font-semibold">
                  {tokenInfo.amount} {tokenInfo.fromToken}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">To (est.)</div>
                <div className="text-white font-semibold">
                  {quote.buyAmount} {tokenInfo.toToken}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Network Fee</div>
                <div className="text-white">
                  {quote.feeAmount} {tokenInfo.fromToken}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Slippage</div>
                <div className="text-white">{quote.slippagePercent}%</div>
              </div>
              <div className="col-span-2">
                <div className="text-gray-500 text-xs">
                  Receive (incl. costs)
                </div>
                <div className="text-white font-semibold">
                  {quote.buyAmountAfterFees} {tokenInfo.toToken}
                </div>
              </div>
            </div>
            <div className="pt-2 mt-2 border-t border-white/5">
              <div className="text-gray-500 text-xs">Route</div>
              <div className="text-white text-sm">
                {tokenInfo.fromToken} → [Batch Auction] → {tokenInfo.toToken}
              </div>
            </div>

            {/* Create Order Button */}
            {quote.postSwapOrderFromQuote && (
              <div className="pt-3 mt-3 border-t border-white/5">
                <CreateOrderButton
                  tokenInfo={tokenInfo}
                  postSwapOrderFromQuote={quote.postSwapOrderFromQuote}
                  onOrderStatusChange={setOrderInProgress}
                  onOrderCompleted={() => setOrderCompleted(true)}
                  isLatestQuote={isLatestQuote}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Component that submits order using client-side Trading SDK
 */
function OrderSubmit({
  tokenInfo,
  publicClient,
  walletClient,
  address
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokenInfo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletClient: any;
  address?: Address;
}) {
  const [status, setStatus] = useState<"submitting" | "success" | "error">(
    "submitting"
  );
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function submitOrder() {
      if (!address) {
        setError("Please connect your wallet");
        setStatus("error");
        return;
      }

      const expectedChainLabel =
        tokenInfo.chain ?? `chain ID ${tokenInfo.chainId}`;

      let activePublicClient = publicClient;
      if (
        !activePublicClient ||
        (activePublicClient.chain &&
          activePublicClient.chain.id !== tokenInfo.chainId)
      ) {
        try {
          const { getPublicClient } = await import("wagmi/actions");
          const { wagmiAdapter } = await import("@/lib/wagmi");
          activePublicClient = await getPublicClient(wagmiAdapter.wagmiConfig, {
            chainId: tokenInfo.chainId
          });
        } catch (publicClientError) {
          console.error(
            "[CLIENT] Unable to resolve public client:",
            publicClientError
          );
        }
      }

      if (!activePublicClient) {
        setError(
          "Unable to reach the selected network. Please try again after reconnecting."
        );
        setStatus("error");
        return;
      }

      let activeWalletClient = walletClient;

      if (!activeWalletClient) {
        try {
          const { getWalletClient } = await import("wagmi/actions");
          const { wagmiAdapter } = await import("@/lib/wagmi");
          activeWalletClient = await getWalletClient(wagmiAdapter.wagmiConfig, {
            account: address,
            chainId: tokenInfo.chainId
          });
        } catch (walletClientError) {
          console.error(
            "[CLIENT] Unable to resolve wallet client for order submission:",
            walletClientError
          );
          setError(
            `Switch your wallet to ${expectedChainLabel} before submitting the order.`
          );
          setStatus("error");
          return;
        }
      }

      if (
        activeWalletClient.chain &&
        activeWalletClient.chain.id !== tokenInfo.chainId
      ) {
        setError(
          `Switch your wallet to ${expectedChainLabel} before submitting the order.`
        );
        setStatus("error");
        return;
      }

      try {
        console.log("[CLIENT] Submitting order with Trading SDK...");

        const result = await quoteAndSubmitSwap(
          activePublicClient,
          activeWalletClient,
          {
            sellToken: tokenInfo.fromTokenAddress as Address,
            sellTokenDecimals: tokenInfo.fromTokenDecimals,
            buyToken: tokenInfo.toTokenAddress as Address,
            buyTokenDecimals: tokenInfo.toTokenDecimals,
            amount: tokenInfo.sellAmount,
            userAddress: address,
            chainId: tokenInfo.chainId
          }
        );

        setOrderId(result.orderId);
        setStatus("success");
      } catch (err) {
        console.error("[CLIENT] Order submission error:", err);
        setError(err instanceof Error ? err.message : "Failed to submit order");
        setStatus("error");
      }
    }

    submitOrder();
  }, [tokenInfo, publicClient, walletClient, address]);

  if (status === "submitting") {
    return (
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="glass-strong rounded-lg p-4">
          <div className="flex items-center gap-2 text-primary-300">
            <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Submitting order via Trading SDK...</span>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="glass-strong rounded-lg p-4">
          <div className="text-red-400">
            {error || "Failed to submit order"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      <div className="glass-strong rounded-lg p-4">
        <div className="text-emerald-400 font-semibold mb-2">
          ✓ Order Submitted!
        </div>
        <div className="text-sm text-gray-300 mb-2">
          Order ID: <span className="font-mono text-xs">{orderId}</span>
        </div>
        <a
          href={`https://explorer.cow.fi/orders/${orderId}?chainId=${tokenInfo.chainId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary-400 hover:text-primary-300"
        >
          View order details →
        </a>
      </div>
    </div>
  );
}

/**
 * Button that calls postSwapOrderFromQuote to submit the order
 * Includes balance checking, approval flow, and proper error handling
 */
function CreateOrderButton({
  tokenInfo,
  postSwapOrderFromQuote,
  onOrderStatusChange,
  onOrderCompleted,
  isLatestQuote = true
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokenInfo: any;
  postSwapOrderFromQuote: () => Promise<string>;
  onOrderStatusChange?: (inProgress: boolean) => void;
  onOrderCompleted?: () => void;
  isLatestQuote?: boolean;
}) {
  const [orderStatus, setOrderStatus] = useState<
    | "idle"
    | "checking-approval"
    | "approving"
    | "creating"
    | "signing"
    | "submitting"
    | "success"
    | "error"
  >("idle");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [isCheckingApproval, setIsCheckingApproval] = useState(true);

  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const isNativeCurrencyTrade =
    tokenInfo.isNativeCurrency ||
    (typeof tokenInfo.fromTokenAddress === "string" &&
      tokenInfo.fromTokenAddress.toLowerCase() ===
        NATIVE_CURRENCY_ADDRESS.toLowerCase());

  const walletChainId = walletClient?.chain?.id;
  const expectedChainLabel = tokenInfo.chain ?? `chain ID ${tokenInfo.chainId}`;
  const chainMismatch =
    walletChainId !== undefined && walletChainId !== tokenInfo.chainId;

  // Get balance for the sell token
  const { data: balance, isLoading: balanceLoading } = useBalance({
    address: address,
    token: isNativeCurrencyTrade
      ? undefined
      : (tokenInfo.fromTokenAddress as Address),
    chainId: tokenInfo.chainId
  });

  // Calculate required amount in smallest unit
  const requiredAmount = parseUnits(
    tokenInfo.amount.toString(),
    tokenInfo.fromTokenDecimals
  );
  const hasEnoughBalance = balance ? balance.value >= requiredAmount : false;

  // Check approval status on mount
  useEffect(() => {
    async function checkApproval() {
      if (chainMismatch) {
        setIsApproved(false);
        setIsCheckingApproval(false);
        return;
      }

      if (!publicClient || !walletClient || !address) {
        setIsCheckingApproval(false);
        return;
      }

      if (isNativeCurrencyTrade) {
        setIsApproved(true);
        setIsCheckingApproval(false);
        return;
      }

      try {
        const allowance = await getCowProtocolAllowance(
          publicClient,
          walletClient,
          {
            tokenAddress: tokenInfo.fromTokenAddress as Address,
            owner: address,
            chainId: tokenInfo.chainId
          }
        );

        setIsApproved(allowance >= requiredAmount);
        setIsCheckingApproval(false);
      } catch (err) {
        console.error("[CLIENT] Error checking approval:", err);
        setIsCheckingApproval(false);
      }
    }

    checkApproval();
  }, [
    chainMismatch,
    publicClient,
    walletClient,
    address,
    tokenInfo.fromTokenAddress,
    tokenInfo.chainId,
    requiredAmount,
    isNativeCurrencyTrade
  ]);

  useEffect(() => {
    if (!chainMismatch && orderStatus === "error" && !errorMessage) {
      setOrderStatus("idle");
    }
  }, [chainMismatch, errorMessage, orderStatus]);

  const handleClick = async () => {
    if (!address) {
      setErrorMessage("Please connect your wallet");
      setOrderStatus("error");
      return;
    }

    setErrorMessage(null);
    setOrderStatus("checking-approval");
    setIsCheckingApproval(true);
    onOrderStatusChange?.(true);

    let activePublicClient;
    let activeWalletClient;

    try {
      const clients = await ensureClientsOnChain({
        targetChainId: tokenInfo.chainId,
        address,
        publicClient,
        walletClient
      });

      activePublicClient = clients.publicClient;
      activeWalletClient = clients.walletClient;
    } catch (err) {
      console.error("[CLIENT] Failed to prepare clients for order:", err);
      const { message } = describeSwitchError(err, expectedChainLabel);
      setErrorMessage(message);
      setOrderStatus("error");
      setIsCheckingApproval(false);
      onOrderStatusChange?.(false);
      return;
    }

    try {
      if (!isNativeCurrencyTrade) {
        const allowance = await getCowProtocolAllowance(
          activePublicClient,
          activeWalletClient,
          {
            tokenAddress: tokenInfo.fromTokenAddress as Address,
            owner: address,
            chainId: tokenInfo.chainId
          }
        );

        if (allowance < requiredAmount) {
          setOrderStatus("approving");

          await approveCowProtocol(activePublicClient, activeWalletClient, {
            tokenAddress: tokenInfo.fromTokenAddress as Address,
            amount: requiredAmount,
            chainId: tokenInfo.chainId
          });
        }

        setIsApproved(true);
      } else {
        setIsApproved(true);
      }

      setIsCheckingApproval(false);

      // Step 2: Create and submit the order
      setOrderStatus("creating");
      console.log("[CLIENT] Calling postSwapOrderFromQuote...");

      setOrderStatus("signing");
      const orderResult = await postSwapOrderFromQuote();

      setOrderStatus("submitting");

      // Extract orderId - it can be a string or an object
      const extractedOrderId =
        typeof orderResult === "string"
          ? orderResult
          : (orderResult as { orderId?: string })?.orderId ||
            String(orderResult);

      console.log("[CLIENT] Order submitted!", extractedOrderId);

      setOrderId(extractedOrderId);
      setOrderStatus("success");

      // Notify parent that order is complete and successful
      onOrderStatusChange?.(false);
      onOrderCompleted?.(); // Stop timer permanently
    } catch (err) {
      console.error("[CLIENT] Order submission error:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to submit order"
      );
      setOrderStatus("error");
      onOrderStatusChange?.(false);
    } finally {
      setIsCheckingApproval(false);
    }
  };

  if (orderStatus === "success") {
    return (
      <div className="space-y-2">
        <div className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-md">
          ✓ Order submitted successfully! Your swap will be executed in the next
          batch auction.
        </div>
        {orderId && (
          <a
            href={`https://explorer.cow.fi/orders/${orderId}?chainId=${tokenInfo.chainId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-primary-400 hover:text-primary-300"
          >
            View order details →
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Balance Display */}
      {balance && (
        <div className="text-xs text-gray-400">
          Balance:{" "}
          {parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(6)}{" "}
          {tokenInfo.fromToken}
        </div>
      )}

      {/* Approval Status */}
      {!isApproved &&
        hasEnoughBalance &&
        !balanceLoading &&
        !isCheckingApproval && (
          <div className="text-xs text-yellow-400 bg-yellow-500/10 px-3 py-2 rounded-md">
            ⚠️ Token approval required. You&apos;ll be asked to approve{" "}
            {tokenInfo.fromToken} before creating the order.
          </div>
        )}

      {/* Error Messages */}
      {!hasEnoughBalance && !balanceLoading && balance && (
        <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-md">
          Insufficient {tokenInfo.fromToken} balance. You need{" "}
          {tokenInfo.amount} {tokenInfo.fromToken} but only have{" "}
          {parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(6)}{" "}
          {tokenInfo.fromToken}.
        </div>
      )}

      {orderStatus === "error" && errorMessage && (
        <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-md">
          {errorMessage}
        </div>
      )}

      {/* Create Order Button */}
      <button
        onClick={handleClick}
        disabled={
          !isLatestQuote ||
          !address ||
          (orderStatus !== "idle" && orderStatus !== "error") ||
          !hasEnoughBalance ||
          balanceLoading ||
          isCheckingApproval
        }
        className={`w-full px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
          !isLatestQuote
            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
            : !address ||
              !hasEnoughBalance ||
              balanceLoading ||
              isCheckingApproval
            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
            : orderStatus !== "idle" && orderStatus !== "error"
            ? "bg-emerald-600 text-white cursor-wait"
            : "bg-emerald-600 hover:bg-emerald-500 text-white"
        }`}
      >
        {!isLatestQuote ? (
          "Expired"
        ) : balanceLoading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Checking balance...
          </span>
        ) : isCheckingApproval ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Checking approval...
          </span>
        ) : orderStatus === "checking-approval" ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Checking approval...
          </span>
        ) : orderStatus === "approving" ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Approve in wallet...
          </span>
        ) : orderStatus === "creating" ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Preparing order...
          </span>
        ) : orderStatus === "signing" ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Sign in wallet...
          </span>
        ) : orderStatus === "submitting" ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Submitting order...
          </span>
        ) : orderStatus === "error" ? (
          "Try Again"
        ) : !hasEnoughBalance ? (
          "Insufficient Balance"
        ) : !isApproved ? (
          "Approve & Create Order"
        ) : (
          "Create Order"
        )}
      </button>
    </div>
  );
}
