"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";

interface ChatProps {
  walletAddress?: string;
  onExecuteSwap?: (data: {
    fromToken: string
    toToken: string
    amount: string
    slippage: string
  }) => void;
}

export function Chat({ walletAddress }: ChatProps) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="glass-strong rounded-2xl overflow-hidden shadow-2xl border border-white/10">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 bg-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
            </div>
            <h2 className="font-semibold text-white">Trading Assistant</h2>
          </div>
          {walletAddress && (
            <div className="px-3 py-1 glass rounded-lg text-xs font-mono text-gray-400">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="h-[500px] overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary-600/20 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Start Trading</h3>
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
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-gradient-to-br from-primary-600 to-primary-700 text-white shadow-glow"
                  : "glass text-gray-200"
              }`}
            >
              <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                {"content" in message ? String(message.content) : ""}
              </div>
              {"toolInvocations" in message && message.toolInvocations && Array.isArray(message.toolInvocations) ? (
                <div className="mt-3 pt-3 border-t border-white/10">
                  {(message.toolInvocations as Array<{ state: string; toolName?: string; result?: unknown }>).map((tool, idx: number) => (
                    <div key={idx} className="text-xs space-y-2">
                      {tool.state === "call" && (
                        <div className="flex items-center gap-2 text-primary-300">
                          <div className="w-3 h-3 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"></div>
                          <span>Calling {tool.toolName}...</span>
                        </div>
                      )}
                      {tool.state === "result" && (
                        <div className="glass rounded-lg p-3 font-mono text-gray-400 overflow-x-auto">
                          <pre>{JSON.stringify(tool.result, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {status === "streaming" && (
          <div className="flex justify-start">
            <div className="glass rounded-2xl px-4 py-3">
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
            sendMessage({ text: input });
            setInput("");
          }
        }}
        className="p-4 border-t border-white/5 bg-white/5"
      >
        <div className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              walletAddress
                ? "Ask me to swap tokens..."
                : "Connect your wallet to start trading"
            }
            disabled={!walletAddress || status === "streaming"}
            className="flex-1 px-4 py-3 glass-strong rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-white placeholder:text-gray-500 transition-all"
          />
          <button
            type="submit"
            disabled={!walletAddress || status === "streaming" || !input.trim()}
            className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-500 hover:to-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-glow hover:shadow-glow-lg"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
