"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { DefaultChatTransport } from "ai";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { quoteAndSubmitSwap } from "@/lib/cowswap-client";
import type { Address } from "viem";

interface ChatProps {
  walletAddress?: string;
}

export function Chat({ walletAddress }: ChatProps) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      headers: {
        "x-wallet-address": walletAddress || ""
      }
    })
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    if (inputRef.current && walletAddress && status !== "streaming") {
      inputRef.current.focus();
    }
  }, [messages, walletAddress, status]);

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

                        // Price display
                        const isPrice = output?.success && output?.price && output?.message;
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

                        // Error handling
                        if (output?.success === false && "userMessage" in output) {
                          return null;
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
          if (input.trim() && walletAddress) {
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
              walletAddress
                ? "Ask me to swap tokens..."
                : "Connect your wallet to start trading"
            }
            disabled={!walletAddress || status === "streaming"}
            className="flex-1 px-0 py-3 bg-transparent border-b border-white/10 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-white placeholder:text-gray-500 transition-colors caret-emerald-500"
          />
        </div>
      </form>
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

  useEffect(() => {
    async function fetchQuote() {
      if (!publicClient || !walletClient || !address) {
        setError("Please connect your wallet");
        setLoading(false);
        return;
      }

      try {
        console.log('[CLIENT] Fetching quote with Trading SDK...');

        // Import and use the client SDK
        const { getSwapQuote } = await import('@/lib/cowswap-client');

        const quoteResponse = await getSwapQuote(
          publicClient,
          walletClient,
          {
            sellToken: tokenInfo.fromTokenAddress as Address,
            sellTokenDecimals: tokenInfo.fromTokenDecimals,
            buyToken: tokenInfo.toTokenAddress as Address,
            buyTokenDecimals: tokenInfo.toTokenDecimals,
            amount: (BigInt(tokenInfo.amount) * BigInt(10 ** tokenInfo.fromTokenDecimals)).toString(),
            userAddress: address,
            chainId: tokenInfo.chainId
          }
        );

        if (!quoteResponse.quoteResults) {
          throw new Error('Failed to get quote');
        }

        const { amountsAndCosts } = quoteResponse.quoteResults;
        const buyAmount = amountsAndCosts.afterSlippage.buyAmount;
        const feeAmount = amountsAndCosts.costs.networkFee.amountInSellCurrency;

        setQuote({
          buyAmount: (Number(buyAmount) / Math.pow(10, tokenInfo.toTokenDecimals)).toFixed(6),
          feeAmount: (Number(feeAmount) / Math.pow(10, tokenInfo.fromTokenDecimals)).toFixed(6),
          postSwapOrderFromQuote: quoteResponse.postSwapOrderFromQuote
        });
        setLoading(false);
      } catch (err) {
        console.error('[CLIENT] Quote fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to get quote');
        setLoading(false);
      }
    }

    fetchQuote();
  }, [tokenInfo, publicClient, walletClient, address]);

  if (loading) {
    return (
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="text-xs flex items-center gap-2 text-primary-300">
          <div className="w-3 h-3 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"></div>
          <span>Fetching quote from Trading SDK...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="glass-strong rounded-lg p-4">
          <div className="text-red-400 text-sm">{error}</div>
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
              CoW Protocol Quote
            </span>
          </div>
          {tokenInfo.chain && (
            <span className="text-xs px-2 py-1 glass rounded-md text-gray-400">
              {tokenInfo.chain}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-gray-500 text-xs">From</div>
            <div className="text-white font-semibold">
              {tokenInfo.amount} {tokenInfo.fromToken}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">To</div>
            <div className="text-white font-semibold">
              {quote.buyAmount} {tokenInfo.toToken}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Fee</div>
            <div className="text-white">
              {quote.feeAmount} {tokenInfo.fromToken}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Price Impact</div>
            <div className="text-white">&lt; 0.01%</div>
          </div>
        </div>
        <div className="pt-2 mt-2 border-t border-white/5">
          <div className="text-gray-500 text-xs">Route</div>
          <div className="text-white text-sm">
            {tokenInfo.fromToken} → [CoW Protocol Batch Auction] → {tokenInfo.toToken}
          </div>
        </div>

        {/* Create Order Button */}
        <div className="pt-3 mt-3 border-t border-white/5">
          <CreateOrderButton
            tokenInfo={tokenInfo}
            postSwapOrderFromQuote={quote.postSwapOrderFromQuote}
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
  const [status, setStatus] = useState<'submitting' | 'success' | 'error'>('submitting');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function submitOrder() {
      if (!publicClient || !walletClient || !address) {
        setError("Please connect your wallet");
        setStatus('error');
        return;
      }

      try {
        console.log('[CLIENT] Submitting order with Trading SDK...');

        const result = await quoteAndSubmitSwap(
          publicClient,
          walletClient,
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
        setStatus('success');
      } catch (err) {
        console.error('[CLIENT] Order submission error:', err);
        setError(err instanceof Error ? err.message : 'Failed to submit order');
        setStatus('error');
      }
    }

    submitOrder();
  }, [tokenInfo, publicClient, walletClient, address]);

  if (status === 'submitting') {
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

  if (status === 'error') {
    return (
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="glass-strong rounded-lg p-4">
          <div className="text-red-400">{error || 'Failed to submit order'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      <div className="glass-strong rounded-lg p-4">
        <div className="text-emerald-400 font-semibold mb-2">✓ Order Submitted!</div>
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
 */
function CreateOrderButton({
  tokenInfo,
  postSwapOrderFromQuote
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokenInfo: any;
  postSwapOrderFromQuote: () => Promise<string>;
}) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setStatus('submitting');
    setError(null);

    try {
      console.log('[CLIENT] Calling postSwapOrderFromQuote...');
      const id = await postSwapOrderFromQuote();

      console.log('[CLIENT] Order submitted!', id);
      setOrderId(id);
      setStatus('success');
    } catch (err) {
      console.error('[CLIENT] Order submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit order');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="space-y-2">
        <div className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-md">
          ✓ Order submitted successfully!
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

  if (status === 'error') {
    return (
      <div className="space-y-2">
        <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-md">
          {error || 'Failed to submit order'}
        </div>
        <button
          onClick={handleSubmit}
          className="w-full px-4 py-3 rounded-lg font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleSubmit}
      disabled={status === 'submitting'}
      className={`w-full px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
        status === 'submitting'
          ? "bg-emerald-600 text-white cursor-wait"
          : "bg-emerald-600 hover:bg-emerald-500 text-white"
      }`}
    >
      {status === 'submitting' ? (
        <span className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          Submitting via Trading SDK...
        </span>
      ) : (
        "Create Order"
      )}
    </button>
  );
}
