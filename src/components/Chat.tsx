"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
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
import { NATIVE_CURRENCY_ADDRESS } from "@/lib/native-currencies";
import type { Address } from "viem";
import { formatUnits, parseUnits } from "viem";

// Global ref to track the latest quote timestamp and listeners
let latestQuoteTimestamp = 0;
const quoteListeners = new Set<() => void>();

function notifyQuoteChange() {
  quoteListeners.forEach(listener => listener());
}

export function Chat() {
  const [input, setInput] = useState("");
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Use a ref to always get the latest address value
  const addressRef = useRef<string | undefined>(address);
  addressRef.current = address;

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const currentAddress = addressRef.current || "";
        console.log(
          "[CLIENT] Sending request with wallet address:",
          currentAddress
        );
        return fetch(input, {
          ...init,
          headers: {
            ...(init?.headers as Record<string, string>),
            "x-wallet-address": currentAddress
          }
        });
      }
    })
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    if (inputRef.current && address && status !== "streaming") {
      inputRef.current.focus();
    }
  }, [messages, address, status]);

  return (
    <div className="bg-black rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[500px]">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary-600/20 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-primary-400"
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
            <h3 className="text-lg font-semibold text-white mb-2">
              Start Trading
            </h3>
            <p className="text-sm text-gray-400 mb-6 max-w-sm">
              Ask me anything about trading. Here are some examples:
            </p>
            <div className="space-y-2 text-sm text-left">
              <div className="glass rounded-lg px-4 py-2 text-gray-300">
                &quot;Swap 1 BNB for USDC on BNB Chain&quot;
              </div>
              <div className="glass rounded-lg px-4 py-2 text-gray-300">
                &quot;What&apos;s the price of CAKE?&quot;
              </div>
              <div className="glass rounded-lg px-4 py-2 text-gray-300">
                &quot;Get me a quote for 100 USDC to DAI on Arbitrum&quot;
              </div>
              <div className="glass rounded-lg px-4 py-2 text-gray-300">
                &quot;Show me the best rate for 0.5 ETH to USDT&quot;
              </div>
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
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-gray-200 bg-transparent`}
            >
              <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
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
                                    (bal: { symbol: string; name: string; balance: string; usdValue?: number }, i: number) => (
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
        className="p-4 flex-shrink-0"
      >
        <div className="flex items-center">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              address
                ? "Ask me to swap tokens..."
                : "Connect your wallet to start trading"
            }
            disabled={!address || status === "streaming"}
            className="flex-1 px-0 py-3 bg-transparent border-b border-white/10 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-white placeholder:text-gray-500 transition-colors caret-emerald-500"
          />
        </div>
      </form>
    </div>
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
            <span className="text-xs font-semibold text-amber-400">
              Notice
            </span>
          </div>
          <div className="text-white text-sm">
            You don&apos;t have any {tokenInfo.fromToken} to swap on {tokenInfo.chain}.
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
          Your {tokenInfo.fromToken} balance: {parseFloat(balanceAmount).toFixed(6)} {tokenInfo.fromToken}
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

  // Function to fetch quote
  const fetchQuote = async () => {
    setLoading(true);
    setError(null);

    if (!publicClient || !walletClient || !address) {
      setError("Please connect your wallet");
      setLoading(false);
      return;
    }

    try {
      console.log("[CLIENT] Fetching quote with Trading SDK...");

      // Import and use the client SDK
      const { getSwapQuote } = await import("@/lib/cowswap-client");

      const quoteResponse = await getSwapQuote(publicClient, walletClient, {
        sellToken: tokenInfo.fromTokenAddress as Address,
        sellTokenDecimals: tokenInfo.fromTokenDecimals,
        buyToken: tokenInfo.toTokenAddress as Address,
        buyTokenDecimals: tokenInfo.toTokenDecimals,
        amount: parseUnits(
          tokenInfo.amount.toString(),
          tokenInfo.fromTokenDecimals
        ).toString(),
        userAddress: address,
        chainId: tokenInfo.chainId
      });

      console.log("[CLIENT] Quote response:", quoteResponse);

      // Check if quote failed or has no results
      if (!quoteResponse || !quoteResponse.quoteResults) {
        console.error("[CLIENT] No quoteResults in response");
        setError(
          "Unable to get a quote for this trade. This may be due to insufficient liquidity or the trade amount being too small. Try adjusting the amount or choosing different tokens."
        );
        setLoading(false);
        return;
      }

      console.log("[CLIENT] quoteResults:", quoteResponse.quoteResults);

      const { amountsAndCosts } = quoteResponse.quoteResults;

      console.log("[CLIENT] amountsAndCosts:", amountsAndCosts);

      // Validate the response structure
      if (
        !amountsAndCosts ||
        !amountsAndCosts.afterSlippage ||
        !amountsAndCosts.afterSlippage.buyAmount ||
        !amountsAndCosts.afterNetworkCosts ||
        !amountsAndCosts.afterNetworkCosts.buyAmount ||
        !amountsAndCosts.costs ||
        !amountsAndCosts.costs.networkFee
      ) {
        console.error(
          "[CLIENT] Invalid quote response structure:",
          amountsAndCosts
        );
        setError(
          "Unable to get a quote for this trade. There may be insufficient liquidity for this token pair. Try using a smaller amount or different tokens."
        );
        setLoading(false);
        return;
      }

      // Use beforeNetworkCosts for the headline quote (matches CoW Swap UI)
      // afterNetworkCosts is what the user receives once network fees are deducted
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

      console.log("[CLIENT] Quote values:", {
        buyAmountBeforeFees: buyAmountBeforeFees.toString(),
        buyAmountAfterNetworkCosts: buyAmountAfterNetworkCosts.toString(),
        networkFeeInSellToken: networkFeeInSellToken.toString(),
        slippageBps
      });

      setQuote({
        buyAmount: formatQuoteAmount(
          buyAmountBeforeFees,
          tokenInfo.toTokenDecimals
        ),
        buyAmountAfterFees: formatQuoteAmount(
          buyAmountAfterNetworkCosts,
          tokenInfo.toTokenDecimals
        ),
        feeAmount: formatQuoteAmount(
          networkFeeInSellToken,
          tokenInfo.fromTokenDecimals
        ),
        slippagePercent,
        postSwapOrderFromQuote: quoteResponse.postSwapOrderFromQuote
      });
      setLoading(false);
      setCountdown(30); // Reset countdown after successful fetch

      // Mark this as the latest quote ONLY after successful fetch
      // AND only if no newer quote has taken over while we were fetching
      if (quoteTimestamp >= latestQuoteTimestamp) {
        latestQuoteTimestamp = quoteTimestamp;
        notifyQuoteChange(); // Notify all quote components to re-render
      }
    } catch (err) {
      console.error("[CLIENT] Quote fetch error:", err);

      // Check for specific error messages
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (errorMessage.toLowerCase().includes("liquidity")) {
        setError(
          "Insufficient liquidity for this trade. Try using a smaller amount or different tokens."
        );
      } else if (errorMessage.toLowerCase().includes("slippage")) {
        setError(
          "Price slippage too high for this trade. Try adjusting the amount or try again later."
        );
      } else {
        setError(
          "Unable to get a quote for this trade. Please try again or use different tokens."
        );
      }

      setLoading(false);
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    // Mark this quote as the latest ONLY after we successfully load
    // This prevents new loading quotes from expiring old ones immediately
    fetchQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown timer with auto-refresh
  useEffect(() => {
    // Only run timer if:
    // 1. Not loading, no error, and quote exists
    // 2. This is the latest quote (not an older quote)
    // 3. No order transaction in progress
    // 4. Order has not been completed
    const isLatest = quoteTimestamp === latestQuoteTimestamp;
    if (loading || error || !quote || !isLatest || orderInProgress || orderCompleted) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Double-check we're still the latest before refreshing
          if (quoteTimestamp === latestQuoteTimestamp) {
            fetchQuote();
          }
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, quote, orderInProgress, orderCompleted, quoteTimestamp]);

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

  // Check if this is the latest quote
  const isLatestQuote = quoteTimestamp === latestQuoteTimestamp;

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      <div className="glass-strong rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-xs font-semibold text-emerald-400">
              CoW Protocol Quote
            </span>
          </div>
          <div className="flex items-center gap-2">
            {tokenInfo.chain && (
              <span className="text-xs px-2 py-1 glass rounded-md text-gray-400">
                {tokenInfo.chain}
              </span>
            )}
            {isLatestQuote && (
              <span
                className="text-xs px-2 py-1 glass rounded-md text-gray-400 cursor-help relative group"
              >
                {countdown}s
                <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded-md whitespace-nowrap z-10 pointer-events-none">
                  Quote refreshes in {countdown} seconds
                  <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-4 border-transparent border-t-gray-900"></span>
                </span>
              </span>
            )}
            {!isLatestQuote && (
              <span className="text-xs px-2 py-1 bg-amber-500/20 rounded-md text-amber-400">
                Expired
              </span>
            )}
          </div>
        </div>
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
            <div className="text-gray-500 text-xs">Receive (incl. costs)</div>
            <div className="text-white font-semibold">
              {quote.buyAmountAfterFees} {tokenInfo.toToken}
            </div>
          </div>
        </div>
        <div className="pt-2 mt-2 border-t border-white/5">
          <div className="text-gray-500 text-xs">Route</div>
          <div className="text-white text-sm">
            {tokenInfo.fromToken} → [CoW Protocol Batch Auction] →{" "}
            {tokenInfo.toToken}
          </div>
        </div>

        {/* Create Order Button */}
        <div className="pt-3 mt-3 border-t border-white/5">
          <CreateOrderButton
            tokenInfo={tokenInfo}
            postSwapOrderFromQuote={quote.postSwapOrderFromQuote}
            onOrderStatusChange={setOrderInProgress}
            onOrderCompleted={() => setOrderCompleted(true)}
            isLatestQuote={isLatestQuote}
          />
        </div>
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
      if (!publicClient || !walletClient || !address) {
        setError("Please connect your wallet");
        setStatus("error");
        return;
      }

      try {
        console.log("[CLIENT] Submitting order with Trading SDK...");

        const result = await quoteAndSubmitSwap(publicClient, walletClient, {
          sellToken: tokenInfo.fromTokenAddress as Address,
          sellTokenDecimals: tokenInfo.fromTokenDecimals,
          buyToken: tokenInfo.toTokenAddress as Address,
          buyTokenDecimals: tokenInfo.toTokenDecimals,
          amount: tokenInfo.sellAmount,
          userAddress: address,
          chainId: tokenInfo.chainId
        });

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
          View on CoW Explorer →
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
    publicClient,
    walletClient,
    address,
    tokenInfo.fromTokenAddress,
    tokenInfo.chainId,
    requiredAmount,
    isNativeCurrencyTrade
  ]);

  const handleClick = async () => {
    if (!publicClient || !walletClient || !address) {
      setErrorMessage("Please connect your wallet");
      setOrderStatus("error");
      return;
    }

    try {
      // Notify parent that order is in progress
      onOrderStatusChange?.(true);

      // Step 1: Check and handle approval if needed
      if (!isApproved) {
        if (isNativeCurrencyTrade) {
          setIsApproved(true);
        } else {
          setOrderStatus("checking-approval");

          const allowance = await getCowProtocolAllowance(
            publicClient,
            walletClient,
            {
              tokenAddress: tokenInfo.fromTokenAddress as Address,
              owner: address,
              chainId: tokenInfo.chainId
            }
          );

          if (allowance < requiredAmount) {
            setOrderStatus("approving");

            await approveCowProtocol(publicClient, walletClient, {
              tokenAddress: tokenInfo.fromTokenAddress as Address,
              amount: requiredAmount,
              chainId: tokenInfo.chainId
            });
          }

          setIsApproved(true);
        }
      }

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

      // Notify parent that order is complete (but with error, so timer can resume)
      onOrderStatusChange?.(false);
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
            View on CoW Explorer →
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
          orderStatus !== "idle" ||
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
              isCheckingApproval ||
              orderStatus === "error"
            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
            : orderStatus !== "idle"
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
