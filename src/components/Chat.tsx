"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { DefaultChatTransport } from "ai";
import { useBalance, useAccount, useSignTypedData, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, erc20Abi } from "viem";

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
  const [creatingOrder, setCreatingOrder] = useState(false);
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
                          feeAmount?: string;
                          quoteId?: number;
                        };
                        const isQuote =
                          output?.success &&
                          output?.estimatedOutput &&
                          output?.fromToken &&
                          output?.toToken;
                        const isPrice =
                          output?.success && output?.price && output?.message;

                        if (isQuote) {
                          // Function to handle create order
                          const handleCreateOrder = async () => {
                            if (
                              !address ||
                              !output.fromToken ||
                              !output.toToken ||
                              !output.inputAmount ||
                              !output.chainId
                            ) {
                              return;
                            }

                            setCreatingOrder(true);

                            try {
                              // Send message to create order
                              await sendMessage({
                                text: `create order for ${output.inputAmount} ${output.fromToken} to ${output.toToken}`
                              });
                            } catch (error) {
                              console.error("Failed to create order:", error);
                            } finally {
                              setCreatingOrder(false);
                            }
                          };

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
                                      CoW Protocol Quote
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

                                {/* Create Order Button */}
                                <div className="pt-3 mt-3 border-t border-white/5">
                                  <CreateOrderButton
                                    fromToken={output.fromToken}
                                    toToken={output.toToken}
                                    amount={output.inputAmount}
                                    chainId={output.chainId}
                                    address={address}
                                    onCreateOrder={handleCreateOrder}
                                    isCreating={creatingOrder}
                                  />
                                </div>
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

                        // Check for error with userMessage
                        if (
                          output?.success === false &&
                          "userMessage" in output
                        ) {
                          // Don't render anything - the AI should handle the userMessage in its text response
                          return null;
                        }

                        // Default tool output (only for non-error cases without special formatting)
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

// Create Order Button Component with Balance Checking
function CreateOrderButton({
  fromToken,
  toToken,
  amount,
  chainId,
  address,
  onCreateOrder,
  isCreating
}: {
  fromToken?: string;
  toToken?: string;
  amount?: string;
  chainId?: number;
  address?: `0x${string}`;
  onCreateOrder: () => void;
  isCreating: boolean;
}) {
  const [orderStatus, setOrderStatus] = useState<
    "idle" | "checking-approval" | "approving" | "creating" | "signing" | "submitting" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();

  // CoW Protocol VaultRelayer address (same across all chains)
  const VAULT_RELAYER = "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110" as `0x${string}`;
  // Get token addresses for balance checking
  const getTokenAddress = (
    symbol: string,
    chain: number
  ): `0x${string}` | undefined => {
    // Token addresses for Arbitrum (42161)
    const arbitrumTokens: Record<string, `0x${string}`> = {
      USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
      WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
      ARB: "0x912CE59144191C1204E64559FE8253a0e49E6548",
      GMX: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a",
      UNI: "0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0"
    };

    // Token addresses for BNB Chain (56)
    const bnbTokens: Record<string, `0x${string}`> = {
      USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      USDT: "0x55d398326f99059fF775485246999027B3197955",
      DAI: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",
      WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
      WETH: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
      BTCB: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
      CAKE: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
      ADA: "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47"
    };

    if (chain === 42161) {
      return arbitrumTokens[symbol.toUpperCase()];
    } else if (chain === 56) {
      return bnbTokens[symbol.toUpperCase()];
    }
    return undefined;
  };

  const tokenAddress =
    fromToken && chainId ? getTokenAddress(fromToken, chainId) : undefined;

  // Fetch balance for the from token
  const { data: balance, isLoading: balanceLoading } = useBalance({
    address: address,
    token: tokenAddress,
    chainId: chainId
  });

  // Check current allowance for CoW Protocol VaultRelayer
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && tokenAddress ? [address, VAULT_RELAYER] : undefined,
    chainId: chainId,
  });

  // Check if user has enough balance
  const hasEnoughBalance =
    balance && amount
      ? parseFloat(formatUnits(balance.value, balance.decimals)) >=
        parseFloat(amount)
      : false;

  // Check if token is approved (allowance >= amount needed)
  const amountInWei = amount && balance ? BigInt(Math.floor(parseFloat(amount) * Math.pow(10, balance.decimals))) : BigInt(0);
  const isApproved = allowance !== undefined && allowance >= amountInWei;

  const handleClick = async () => {
    if (!address || !fromToken || !toToken || !amount || !chainId || !tokenAddress) {
      return;
    }

    if (!hasEnoughBalance) {
      return; // Button will be disabled
    }

    try {
      setOrderStatus("checking-approval");
      setErrorMessage("");

      // Step 1: Check and handle token approval
      if (!isApproved) {
        setOrderStatus("approving");

        // Request approval for the exact amount (or you could use max: 2^256-1)
        const approveTx = await writeContractAsync({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [VAULT_RELAYER, amountInWei],
          chainId: chainId,
        });

        console.log("Approval transaction:", approveTx);

        // Wait a moment and refetch allowance
        await new Promise(resolve => setTimeout(resolve, 2000));
        await refetchAllowance();
      }

      // Step 2: Create order
      setOrderStatus("creating");
      setErrorMessage("");

      // Step 1: Get order data from API
      const orderResponse = await fetch("/api/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": address
        },
        body: JSON.stringify({
          fromToken,
          toToken,
          amount,
          chainId
        })
      });

      const orderResult = await orderResponse.json();

      if (!orderResult.success || !orderResult.needsSignature) {
        throw new Error(orderResult.error || "Failed to create order");
      }

      // Step 2: Sign the order using EIP-712
      setOrderStatus("signing");

      const { orderData } = orderResult;

      // Log the order data we're about to sign
      console.log("Order data to sign:", JSON.stringify(orderData, null, 2));
      console.log("User address:", address);

      // CoW Protocol EIP-712 domain and types
      const domain = {
        name: "Gnosis Protocol",
        version: "v2",
        chainId: chainId,
        verifyingContract:
          "0x9008D19f58AAbD9eD0D60971565AA8510560ab41" as `0x${string}` // GPv2Settlement contract
      };

      const types = {
        Order: [
          { name: "sellToken", type: "address" },
          { name: "buyToken", type: "address" },
          { name: "receiver", type: "address" },
          { name: "sellAmount", type: "uint256" },
          { name: "buyAmount", type: "uint256" },
          { name: "validTo", type: "uint32" },
          { name: "appData", type: "bytes32" },
          { name: "feeAmount", type: "uint256" },
          { name: "kind", type: "string" },
          { name: "partiallyFillable", type: "bool" },
          { name: "sellTokenBalance", type: "string" },
          { name: "buyTokenBalance", type: "string" }
        ]
      };

      console.log("EIP-712 domain:", domain);
      console.log("EIP-712 types:", types);

      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType: "Order",
        message: orderData
      });

      console.log("Signature:", signature);

      // Step 3: Submit signed order with the SAME order data that was signed
      setOrderStatus("submitting");

      const submitResponse = await fetch("/api/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": address
        },
        body: JSON.stringify({
          fromToken,
          toToken,
          amount,
          chainId,
          signature,
          orderData // Send the exact same order data that was signed
        })
      });

      const submitResult = await submitResponse.json();

      if (!submitResult.success) {
        throw new Error(submitResult.error || "Failed to submit order");
      }

      setOrderStatus("success");

      // Call the original onCreateOrder callback
      onCreateOrder();
    } catch (error) {
      console.error("Order creation error:", error);
      setOrderStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create order"
      );
    }
  };

  return (
    <div className="space-y-2">
      {/* Balance Display */}
      {balance && (
        <div className="text-xs text-gray-400">
          Balance:{" "}
          {parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(6)}{" "}
          {fromToken}
        </div>
      )}

      {/* Approval Status */}
      {!isApproved && hasEnoughBalance && !balanceLoading && (
        <div className="text-xs text-yellow-400 bg-yellow-500/10 px-3 py-2 rounded-md">
          ⚠️ Token approval required. You&apos;ll be asked to approve {fromToken} before creating the order.
        </div>
      )}

      {/* Error Messages */}
      {!hasEnoughBalance && !balanceLoading && balance && (
        <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-md">
          Insufficient {fromToken} balance. You need {amount} {fromToken} but
          only have{" "}
          {parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(6)}{" "}
          {fromToken}.
        </div>
      )}

      {orderStatus === "error" && errorMessage && (
        <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-md">
          {errorMessage}
        </div>
      )}

      {orderStatus === "success" && (
        <div className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-md">
          Order submitted successfully! Your swap will be executed in the next
          batch auction.
        </div>
      )}

      {/* Create Order Button */}
      <button
        onClick={handleClick}
        disabled={
          !address ||
          orderStatus !== "idle" ||
          !hasEnoughBalance ||
          balanceLoading
        }
        className={`w-full px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
          !address ||
          !hasEnoughBalance ||
          balanceLoading ||
          orderStatus === "error"
            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
            : orderStatus !== "idle"
            ? "bg-emerald-600 text-white cursor-wait"
            : "bg-emerald-600 hover:bg-emerald-500 text-white"
        } ${orderStatus === "success" ? "bg-emerald-700" : ""}`}
      >
        {balanceLoading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Checking balance...
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
        ) : orderStatus === "success" ? (
          "✓ Order Submitted"
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
