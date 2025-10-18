"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

interface Token {
  token_type: string;
  name: string;
  symbol: string;
  balance_formatted: string;
  usd_value?: number | null;
}

interface Position {
  protocol_name: string;
  protocol_id: string;
  position: {
    label: string;
    tokens: Token[];
    balance_usd: number | null;
    position_details?: Record<string, unknown>;
  };
}

interface Props {
  positions: Position[];
  walletAddress?: string;
}

export function FloatingPositionsChat({ positions, walletAddress }: Props) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/positions-chat",
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        return fetch(input, {
          ...init,
          headers: {
            ...(init?.headers as Record<string, string>),
            "x-wallet-address": walletAddress || "",
            "x-positions-data": JSON.stringify(positions),
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
    "What is my total position value?",
    "Explain my liquidity positions",
    "What are the risks in my portfolio?",
    "How is my Uniswap position performing?",
  ];

  return (
    <div className="fixed bottom-6 right-6 z-40 max-w-2xl">
      <div className="w-full">
        {/* Messages Container */}
        {messages.length > 0 && (
          <div className="mb-4 bg-black/95 backdrop-blur-xl rounded-2xl border border-white/20 max-h-[400px] overflow-y-auto shadow-2xl">
            <div className="px-6 py-6 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[75%] rounded-xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-primary-600/20 text-white border border-primary-500/30"
                        : "glass text-gray-200"
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
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
                  <div className="glass rounded-xl px-4 py-3">
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
        )}

        {/* Input Container */}
        <div className="bg-black/95 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl">
          <div className="px-4 py-3">
            {messages.length === 0 && positions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs text-gray-400">
                    Ask AI about positions
                  </p>
                  <span className="text-xs text-amber-400">
                    (Coming Soon)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedQuestions.map((question, idx) => (
                    <div
                      key={idx}
                      className="text-xs glass rounded px-2 py-1 text-gray-500 cursor-not-allowed"
                    >
                      {question}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
