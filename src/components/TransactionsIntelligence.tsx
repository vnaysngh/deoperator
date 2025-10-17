"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

interface Transaction {
  hash: string;
  nonce: string;
  from_address: string;
  from_address_label: string | null;
  to_address: string;
  to_address_label: string | null;
  value: string;
  gas: string;
  gas_price: string;
  receipt_gas_used: string;
  receipt_status: string;
  block_timestamp: string;
  block_number: string;
  input: string;
}

interface Props {
  transactions: Transaction[];
  walletAddress?: string;
}

export function TransactionsIntelligence({ transactions, walletAddress }: Props) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/transactions-chat",
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        return fetch(input, {
          ...init,
          headers: {
            ...(init?.headers as Record<string, string>),
            "x-wallet-address": walletAddress || "",
            "x-transactions-data": JSON.stringify(transactions),
          },
        });
      },
    }),
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const suggestedQuestions = [
    "What's my total transaction activity?",
    "Explain my most recent transaction",
    "How much gas have I spent?",
    "Show me my largest transactions",
    "What are gas fees?",
    "Why did a transaction fail?",
  ];

  return (
    <div className="glass-strong rounded-xl border border-white/10 overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-gradient-to-r from-primary-600/10 to-blue-600/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-600/20 flex items-center justify-center">
            <span className="text-lg">🤖</span>
          </div>
          <div>
            <h3 className="font-semibold text-white">Transaction Intelligence</h3>
            <p className="text-xs text-gray-400">
              Ask anything about your transactions
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Hi! I can help you understand your transaction history. Try asking:
            </p>
            <div className="grid grid-cols-1 gap-2">
              {suggestedQuestions.map((question, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInput(question);
                    setTimeout(() => {
                      if (inputRef.current) {
                        inputRef.current.focus();
                      }
                    }, 100);
                  }}
                  className="text-left text-xs glass rounded-lg p-2 hover:bg-white/10 transition-colors text-gray-300"
                >
                  {question}
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
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                message.role === "user"
                  ? "bg-primary-600/20 text-white border border-primary-500/30"
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
          if (input.trim() && transactions.length > 0) {
            sendMessage({ text: input });
            setInput("");
          }
        }}
        className="p-3 border-t border-white/10"
      >
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              transactions.length > 0
                ? "Ask about your transactions..."
                : "No transactions to analyze"
            }
            disabled={transactions.length === 0 || status === "streaming"}
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-white placeholder:text-gray-500 text-sm transition-colors"
          />
          <button
            type="submit"
            disabled={
              !input.trim() || transactions.length === 0 || status === "streaming"
            }
            className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all"
          >
            →
          </button>
        </div>
      </form>
    </div>
  );
}
