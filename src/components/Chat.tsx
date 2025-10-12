"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { DefaultChatTransport } from "ai";

interface ChatProps {
  walletAddress?: string;
  onExecuteSwap?: (data: {
    fromToken: string;
    toToken: string;
    amount: string;
    slippage: string;
  }) => void;
}

export function Chat({ walletAddress }: ChatProps) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat"
    })
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    // Keep input focused after new messages
    if (inputRef.current && walletAddress && status !== "streaming") {
      inputRef.current.focus();
    }
  }, [messages, walletAddress, status]);

  return (
    <div className="bg-black rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
      {/* Header */}
      {/*  <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
            </div>
            <h2 className="font-semibold text-white">Trading Assistant</h2>
          </div>
          {walletAddress && (
            <div className="px-3 py-1 rounded-lg text-xs font-mono text-gray-400">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </div>
          )}
        </div>
      </div> */}

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
                &quot;Swap 1 WETH for USDC&quot;
              </div>
              <div className="glass rounded-lg px-4 py-2 text-gray-300">
                &quot;What&apos;s the price of WBTC?&quot;
              </div>
              <div className="glass rounded-lg px-4 py-2 text-gray-300">
                &quot;Get me a quote for 100 USDC to DAI&quot;
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
                        // Check if this is a swap quote output
                        const output = part.output as {
                          success?: boolean;
                          chain?: string;
                          chainId?: number;
                          estimatedOutput?: string;
                          fromToken?: string;
                          toToken?: string;
                          inputAmount?: string;
                          priceImpact?: string;
                          gasEstimate?: string;
                          route?: string;
                          price?: string;
                          message?: string;
                        };
                        const isQuote =
                          output?.success &&
                          output?.estimatedOutput &&
                          output?.fromToken &&
                          output?.toToken;
                        const isPrice =
                          output?.success && output?.price && output?.message;

                        if (isQuote) {
                          return (
                            <div
                              key={index}
                              className="mt-3 pt-3 border-t border-white/10"
                            >
                              <div className="glass-strong rounded-lg p-4 space-y-2">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <span className="text-xs font-semibold text-emerald-400">
                                      SushiSwap Quote
                                    </span>
                                  </div>
                                  {output.chain && (
                                    <span className="text-xs px-2 py-1 glass rounded-md text-gray-400">
                                      {output.chain}
                                    </span>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <div className="text-gray-500 text-xs">
                                      From
                                    </div>
                                    <div className="text-white font-semibold">
                                      {output.inputAmount} {output.fromToken}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-gray-500 text-xs">
                                      To
                                    </div>
                                    <div className="text-white font-semibold">
                                      {output.estimatedOutput} {output.toToken}
                                    </div>
                                  </div>
                                  {output.priceImpact &&
                                    output.priceImpact !== "N/A" && (
                                      <div>
                                        <div className="text-gray-500 text-xs">
                                          Price Impact
                                        </div>
                                        <div className="text-white">
                                          {output.priceImpact}
                                        </div>
                                      </div>
                                    )}
                                  {output.gasEstimate &&
                                    output.gasEstimate !== "N/A" && (
                                      <div>
                                        <div className="text-gray-500 text-xs">
                                          Gas Estimate
                                        </div>
                                        <div className="text-white">
                                          {output.gasEstimate}
                                        </div>
                                      </div>
                                    )}
                                </div>
                                {output.route && (
                                  <div className="pt-2 mt-2 border-t border-white/5">
                                    <div className="text-gray-500 text-xs">
                                      Route
                                    </div>
                                    <div className="text-white text-sm">
                                      {output.route}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }

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

                        // Default tool output
                        return (
                          <div
                            key={index}
                            className="mt-3 pt-3 border-t border-white/10"
                          >
                            <div className="text-xs glass rounded-lg p-3 font-mono text-gray-400 overflow-x-auto">
                              <pre>{JSON.stringify(part.output, null, 2)}</pre>
                            </div>
                          </div>
                        );
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
                              <span>Fetching real-time quote...</span>
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
