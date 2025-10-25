"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { formatUnits, parseUnits } from "viem";
import { CreateOrderButton } from "./CreateOrderButton";

// Global ref to track the latest quote timestamp and listeners
let latestQuoteTimestamp = 0;
const quoteListeners = new Set<() => void>();

function notifyQuoteChange() {
  quoteListeners.forEach((listener) => listener());
}

type QuoteDisplayProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokenInfo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletClient: any;
  address?: Address;
};

/**
 * Component that fetches and displays quote using client-side Trading SDK
 */
export function QuoteDisplay({
  tokenInfo,
  publicClient,
  walletClient,
  address
}: QuoteDisplayProps) {
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
      // Check if this is MegaETH - use GTE SDK, otherwise use CoW SDK
      const isMegaEth = tokenInfo.isMegaEth || chainId === 6342;

      if (isMegaEth) {
        console.log("[CLIENT] Fetching quote with GTE SDK...");

        // Import and use the GTE SDK
        const { getGteSwapQuote } = await import("@/lib/gte-swap-client");

        const gteQuote = await getGteSwapQuote({
          sellToken: fromTokenAddress as Address,
          buyToken: toTokenAddress as Address,
          sellAmount: amount.toString(),
          sellDecimals: fromTokenDecimals,
          buyDecimals: toTokenDecimals,
          sellSymbol: tokenInfo.fromToken || "TOKEN",
          buySymbol: tokenInfo.toToken || "TOKEN"
        });

        // Format amounts for display (similar to CoW quote formatting)
        const formatQuoteAmount = (value: bigint | string, decimals: number) => {
          const normalized = formatUnits(BigInt(value), decimals);
          return Number(normalized).toFixed(6);
        };

        const slippagePercent = ((gteQuote.slippageBps || 50) / 100).toFixed(2);

        // Build quote object with flat structure for UI
        const formattedQuote = {
          buyAmount: formatQuoteAmount(gteQuote.expectedAmountOutAtomic, toTokenDecimals),
          buyAmountAfterFees: formatQuoteAmount(gteQuote.minAmountOutAtomic, toTokenDecimals),
          feeAmount: "0.000000", // GTE doesn't charge separate network fees
          slippagePercent,
          gteQuote, // Store raw quote for order submission
          postSwapOrderFromQuote: async () => {
            console.log("[GTE CLIENT] Submitting swap order...");
            const { submitGteSwap } = await import("@/lib/gte-swap-client");

            const result = await submitGteSwap({
              quote: gteQuote,
              userAddress: address!,
              publicClient: activePublicClient,
              walletClient: activeWalletClient,
              useNativeIn: tokenInfo.isNativeCurrency || false,
              useNativeOut: false
            });

            return result.txHash;
          }
        };

        setQuote(formattedQuote);
        setLoading(false);
        setCountdown(30);

        // Update global latest timestamp
        if (latestQuoteTimestamp < quoteTimestamp) {
          latestQuoteTimestamp = quoteTimestamp;
          notifyQuoteChange();
        }

        return;
      }

      console.log("[CLIENT] Fetching quote with CoW Trading SDK...");

      // Import and use the CoW client SDK
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
      } else if (errorMessage.includes("NEXT_PUBLIC_PARTNER_FEE_RECIPIENT")) {
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
    walletClient,
    tokenInfo.fromToken,
    tokenInfo.isMegaEth,
    tokenInfo.isNativeCurrency,
    tokenInfo.toToken
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-xs font-semibold text-emerald-400">
              Live Swap Quote
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
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
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
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
                {tokenInfo.fromToken} → {tokenInfo.toToken}
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
