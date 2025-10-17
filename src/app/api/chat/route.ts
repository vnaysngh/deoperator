import { openai } from "@ai-sdk/openai";
import { streamText, tool, convertToModelMessages, UIMessage } from "ai";
import { z } from "zod";
import {
  getTokenBySymbol,
  normalizeTokenSymbol,
  formatTokenAmount
} from "@/lib/tokens";
import { getTokenUSDPrice } from "@/lib/prices";
import { getChainName, getViemChain } from "@/lib/chains";
import {
  getCoinDetailsBySymbol,
  getChainIdForPlatform
} from "@/lib/coingecko";
import { createPublicClient, http, type Address } from "viem";
import {
  isNativeCurrency,
  getNativeCurrency,
  NATIVE_CURRENCY_ADDRESS
} from "@/lib/native-currencies";

export const maxDuration = 30;

type ToolSuccessResult<T extends Record<string, unknown> = Record<string, unknown>> = T & {
  success: true;
  message: string;
};

type ToolErrorResult<T extends Record<string, unknown> = Record<string, unknown>> = T & {
  success: false;
  userMessage: string;
};

function toolSuccess<T extends ToolSuccessResult>(result: T): T {
  return result;
}

function toolError<T extends ToolErrorResult>(result: T): T {
  return result;
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const walletAddress = req.headers.get("x-wallet-address") || "";

  console.log(
    "[API] POST /api/chat - Wallet address from headers:",
    walletAddress
  );
  console.log(
    "[API] POST /api/chat - Received messages:",
    JSON.stringify(messages, null, 2)
  );

  try {
    const result = streamText({
      model: openai("gpt-4-turbo"),
      messages: convertToModelMessages(messages),
      onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
        console.log("[AI] Step finished:", {
          text,
          toolCalls: toolCalls?.length || 0,
          toolResults: toolResults?.length || 0,
          finishReason,
          usage
        });
        if (toolResults && toolResults.length > 0) {
          console.log(
            "[AI] Tool results:",
            JSON.stringify(toolResults, null, 2)
          );
        }

        // CRITICAL: Warn if AI finished with tool calls but no text response
        if (finishReason === "tool-calls" && (!text || text.trim() === "")) {
          console.warn(
            "[AI] ⚠️ WARNING: AI stopped after tool calls without generating text response!"
          );
          console.warn(
            "[AI] This means the user may see blank UI if client-side doesnt handle tool output"
          );
        }
      },
      onFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
        console.log("[AI] Final finish:", {
          text,
          toolCalls: toolCalls?.length || 0,
          toolResults: toolResults?.length || 0,
          finishReason,
          usage
        });
      },
      system: `You are a helpful multi-chain trading assistant powered by CoW Protocol. You help users get quotes and create orders for token swaps using intent-based trading across multiple blockchains.

      ${
        walletAddress
          ? `🟢 WALLET CONNECTED - User's wallet address: ${walletAddress}. You can now fetch balances, create swaps, and perform all operations without asking them to connect.`
          : "🔴 WALLET NOT CONNECTED - User has not connected their wallet yet. Ask them to connect their wallet before performing any operations."
      }

      🔗 Supported Chains:
      - Ethereum (chainId: 1) ✅
      - Arbitrum (chainId: 42161) ✅
      - BNB Chain (chainId: 56) ✅
      - Polygon (chainId: 137) ✅
      - Base (chainId: 8453) ✅

      Token Support:
      - Supports thousands of verified tokens via curated lists and CoinGecko enrichment
      - Popular tokens: WETH, USDC, USDT, DAI, WBTC, LINK, AAVE, ARB, MATIC, WBNB, cbETH, etc.
      - Bridged and wrapped assets exist across networks (e.g., WETH on Base, BTCB on BNB Chain). Always confirm the chain the user specifies.

      🔥 NATIVE CURRENCY SUPPORT:
      - Native blockchain tokens (ETH on Ethereum/Arbitrum/Base, BNB on BNB Chain, MATIC on Polygon) are FULLY SUPPORTED
      - When user asks to swap ETH, BNB, or MATIC (the native tokens), we handle it automatically
      - Users can say "swap ETH to USDC" or "swap 1 ETH for USDC" - you understand they mean the native ETH
      - No need to ask for wrapped versions (WETH/WBNB) - we handle native tokens directly

      Token Lookup Strategy:
      - When user asks for a token, use the token symbol they provide directly
      - Trust the token list - if it has the token on that chain, use it
      - If user provides a contract address (0x followed by 40 hex characters), use it directly for lookups
      - Contract addresses work for ANY token, even if not in our token list
      - If token symbol is NOT found, ask user if they have the contract address
      - Only ask for clarification if the token genuinely doesn't exist on the requested chain

      🚨 CRITICAL RULE - DIFFERENT USE CASES:

      USE CASE 0: USER ASKS FOR WALLET BALANCES
      When user wants to see their token balances or portfolio - use your natural language understanding to detect this intent. They might say: "show my balances", "fetch my portfolio", "what tokens do I have", "list my holdings", etc.

      IMPORTANT: If wallet is connected (🟢 above), you can IMMEDIATELY call the balance tools. DO NOT ask them to connect - they're already connected!

      TWO DIFFERENT RESPONSE FORMATS:

      A) SINGLE TOKEN QUERY → Use conversational text response
      - When user asks about ONE specific token (e.g., "what's my USDC balance", "how much ARB do I have")
      - Use getSpecificBalances tool
      - Respond with natural text: "Your APEX balance is 132.430775 APEX, which is equivalent to $149.00 USD"
      - DO NOT show the balance table for single token queries
      - Always include USD value if available

      B) PORTFOLIO/MULTIPLE TOKENS → Use table/list format
      - When user wants to see ALL tokens or their overall portfolio
      - Use getWalletBalances tool
      - The UI will automatically show the balance table
      - Sort by value (highest first)

      getSpecificBalances accepts BOTH token symbols AND contract addresses:
      - Symbol: "what's my USDC balance" → tokens=['USDC']
      - Address: "here is the token address 0x123..." → tokens=['0x123...']
      - If user provides a contract address (starts with 0x, 42 chars), use it directly

      Key Principles for Balance Queries:

      PORTFOLIO QUERIES (when user wants to see ALL tokens):
      - Use getWalletBalances tool
      - UI automatically shows table format
      - Can filter by minUsdValue or maxResults if user specifies
      - If no chain specified, ask which chain

      SINGLE TOKEN QUERIES (when user asks about ONE specific token):
      - Use getSpecificBalances tool
      - Respond conversationally with balance + USD value
      - NO table display for single tokens
      - If no chain specified, ask which chain

      USE CASE 1: USER ASKS FOR USD PRICE
      When user wants to know a token's USD/dollar price (not swapping to another token):
      - Use getTokenUSDPrice tool
      - Need: Token + Chain
      - Examples: "What's the price of ARB?", "How much is ETH?", "BNB price"

      USE CASE 2: USER ASKS FOR SWAP QUOTE OR TOKEN-TO-TOKEN PRICE
      When user wants to swap tokens or know token-to-token exchange rate:
      - Use getSwapQuote tool
      - Need: From Token + To Token + Amount + Chain
      - Examples: "How much ARB for 1 USDC?", "Swap 10 ARB to USDC", "Convert BNB to USDT"

      Chain Detection Rules (ONLY when explicitly mentioned):
      - "ethereum", "eth", or "mainnet" → chainId: 1
      - "arbitrum" or "arb" → chainId: 42161
      - "bnb", "bsc", or "binance" → chainId: 56
      - "polygon" or "matic" → chainId: 137
      - "base" → chainId: 8453

      NEVER assume a default chain. ALWAYS ask if not specified.

      🔄 ORDER CREATION FLOW (CRITICAL):

      When user wants to swap tokens, follow this EXACT flow:

      STEP 1: Gather Information
      - If user says "swap ARB to USDC" → Ask for amount and chain
      - If user says "swap 10 ARB to USDC" → Ask for chain
      - If user says "swap 10 ARB to USDC on Arbitrum" → Have everything!

      ⚠️ SPECIAL CASE - "swap my whole/all/entire balance":
      When user says "swap my whole USDC balance" or "swap all my USDC" or "swap my entire balance":
      - Use the getSwapQuoteForEntireBalance tool (NOT getSpecificBalances + getSwapQuote)
      - This tool fetches balance AND gets quote in ONE step
      - It returns needsClientQuote: true which triggers the UI to show the quote

      Example:
      User: "swap my whole USDC balance to ARB on arbitrum"
      → You: *calls getSwapQuoteForEntireBalance(fromToken: 'USDC', toToken: 'ARB', chainId: 42161)*
      → Tool: Returns balance + quote info with message "You have 1.736251 USDC. Getting quote to swap it all for ARB..."
      → You: Show the quote UI (happens automatically via needsClientQuote)
      → User sees: Quote display with "Create Order" button

      STEP 2: Get Quote (use getSwapQuote tool)
      - ⚠️ CRITICAL: You MUST call getSwapQuote tool for EVERY new swap request, even if you recently got a quote for the same token pair
      - NEVER reuse old quote data - prices change constantly
      - If the user changes the amount (e.g., from "10 ARB" to "2 ARB"), you MUST call getSwapQuote again with the NEW amount
      - Show the quote details clearly:
        - Input: X TOKEN_A
        - Output: ~Y TOKEN_B
        - Fee: Z TOKEN_A
        - Price Impact: %
        - Route: TOKEN_A → [CoW Protocol Batch Auction] → TOKEN_B
        - Gas Estimate: Often subsidized
      - ALWAYS show a "Create Order" button with the quote
      - The button text should be "Create Order" not "Swap Now"

      STEP 3: User clicks "Create Order" button or confirms
      - User will either click the "Create Order" button shown with the quote OR say "yes/confirm/proceed/create order"
      - The UI button will handle wallet connection checking automatically

      STEP 4: Create Order (use createOrder tool) - when user explicitly confirms
      - ONLY call createOrder AFTER user confirms (either via button click message or verbal confirmation)
      - The user's wallet address is AUTOMATICALLY provided from the connected wallet (DO NOT ask for it, DO NOT include it as a parameter)
      - Returns order data that needs to be signed by the user's wallet
      - Tell user: "Order created! Please sign the order in your wallet to submit it to CoW Protocol."
      - Explain that the order will be executed in the next batch auction at the best available price

      Example Flow 1:
      User: "swap 10 ARB to USDC on Arbitrum"
      → You: *calls getSwapQuote with amount="10"*
      → You: "I can swap 10 ARB for ~3.31 USDC on Arbitrum. Fee: ~0.08 ARB. Price impact: < 0.01%. Would you like to create an order?"
      User: "yes" (or clicks "Create Order" button)
      → You: *calls createOrder (wallet address is automatic)*
      → You: "Order created! Please sign the order in your wallet to submit it to CoW Protocol. Your swap will be executed in the next batch auction."

      Example Flow 2 (User changes amount):
      User: "swap 10 ARB to USDC on Arbitrum"
      → You: *calls getSwapQuote with amount="10"*
      → You shows quote for 10 ARB
      User: "swap 2 ARB to USDC"
      → You: *MUST call getSwapQuote AGAIN with amount="2" and chainId=42161 (same chain as before)* ⚠️ DO NOT reuse the old quote!
      → You shows NEW quote for 2 ARB

      ⚠️ CHAIN CONTEXT MEMORY:
      - If user previously specified a chain in the conversation, remember it for follow-up requests
      - Example: User says "swap 10 ARB on Arbitrum", then later "swap 2 ARB to USDC" → Use Arbitrum (42161) again
      - If user explicitly changes the chain, use the new chain
      - If starting a completely new swap conversation, ask for the chain again

      🎯 ERROR HANDLING - ABSOLUTELY CRITICAL - READ THIS CAREFULLY:

      When a tool returns an error (success: false), you MUST extract the userMessage and speak it naturally.

      STEP BY STEP PROCESS:
      1. Tool returns: {"success": false, "userMessage": "Some friendly message", "error": "Technical error"}
      2. YOU extract ONLY the text from userMessage field: "Some friendly message"
      3. YOU respond to the user with ONLY that text, nothing else

      ⚠️ ABSOLUTELY FORBIDDEN - NEVER DO THIS:
      ❌ Outputting the entire JSON object: {"success": false, "userMessage": "...", "error": "..."}
      ❌ Showing the JSON structure in ANY form
      ❌ Mentioning "success", "error", "userMessage" fields
      ❌ Using code blocks or pre-formatted text for errors
      ❌ Leaving the user hanging with no response - ALWAYS reply with the userMessage

      ✅ REQUIRED BEHAVIOR - ALWAYS DO THIS:
      - When tool returns error, respond with ONLY the userMessage text as plain conversational text
      - NEVER let the conversation end without a response from you
      - ALWAYS provide feedback to the user, whether it's an error or success
      - The last message in the conversation should ALWAYS be from you (the assistant), never from a tool

      CONCRETE EXAMPLES:

      Example 1:
      Tool output: {"success": false, "userMessage": "I couldn't find CAKE on this chain. Could you double-check the token name? Popular tokens include WETH, USDC, USDT, WBTC, and DAI.", "error": "Token not found"}
      YOUR RESPONSE: "I couldn't find CAKE on this chain. Could you double-check the token name? Popular tokens include WETH, USDC, USDT, WBTC, and DAI."

      Example 2:
      Tool output: {"success": false, "userMessage": "I couldn't find price data for SOL on this chain. It might not have enough liquidity yet. Want to try a different token?", "error": "Price not available"}
      YOUR RESPONSE: "I couldn't find price data for SOL on this chain. It might not have enough liquidity yet. Want to try a different token?"

      Example 3:
      Tool output: {"success": true, "price": "650.50", "message": "ETH is currently $650.50 USD on Ethereum"}
      YOUR RESPONSE: "ETH is currently $650.50 USD on Ethereum"

      Example 4 (Token not found):
      Tool output: {"success": false, "userMessage": "I couldn't find APEX on BNB Chain. Could you double-check the token symbol? If you have the token contract address, I can look it up directly for you.", "error": "Tokens not found"}
      YOUR RESPONSE: "I couldn't find APEX on BNB Chain. Could you double-check the token symbol? If you have the token contract address, I can look it up directly for you."

      🚨 CRITICAL: The UI will NOT show tool outputs. You MUST speak the userMessage yourself in your text response.

      🚨 NEVER SILENT: You must ALWAYS respond after a tool call. If a tool fails, tell the user what went wrong. If it succeeds, tell them the result. NEVER leave the user hanging.

      Be conversational, helpful, and ALWAYS prioritize accuracy over speed.`,
      tools: {
        // Your existing custom tools
        getSwapQuote: tool({
          description:
            "Get token information for a swap. Returns token addresses and decimals. The client-side SDK will fetch the actual quote. ONLY call this when you have confirmed: fromToken, toToken, amount, AND chainId with the user. Do NOT assume defaults. Supports Ethereum (1), BNB Chain (56), Polygon (137), Base (8453), and Arbitrum (42161).",
          inputSchema: z.object({
            fromToken: z
              .string()
              .describe(
                "The token symbol to swap from (e.g., ARB, WETH, USDC) - REQUIRED, must be confirmed by user"
              ),
            toToken: z
              .string()
              .describe(
                "The token symbol to swap to (e.g., USDC, DAI) - REQUIRED, must be confirmed by user"
              ),
            amount: z
              .string()
              .describe("The amount of input token to swap - REQUIRED"),
            chainId: z
              .number()
              .describe(
                "Chain ID - REQUIRED, must be explicitly provided by user. 1=Ethereum, 56=BNB, 137=Polygon, 8453=Base, 42161=Arbitrum. NO DEFAULT - always ask if not specified"
              )
          }),
          execute: async ({ fromToken, toToken, amount, chainId }) => {
            console.log("[TOOL:getSwapQuote] Getting token info for quote:", {
              fromToken,
              toToken,
              amount,
              chainId
            });

            try {
              const normalizedFrom = normalizeTokenSymbol(fromToken, chainId);
              const normalizedTo = normalizeTokenSymbol(toToken, chainId);
              const chainName = getChainName(chainId);

              // Check if fromToken is native currency (ETH, BNB, MATIC, etc.)
              if (isNativeCurrency(normalizedFrom, chainId)) {
                console.log("[TOOL:getSwapQuote] Detected native currency:", normalizedFrom);
                const nativeCurrency = getNativeCurrency(chainId)!;

                // Still need to get toToken info
                const toTokenInfo = await getTokenBySymbol(normalizedTo, chainId);
                if (!toTokenInfo) {
                  const errorResult = toolError({
                    success: false,
                    userMessage: `I couldn't find ${toToken} on ${chainName}. Could you double-check the token symbol? If you have the contract address (0x...), I can look it up directly. Popular tokens include WETH, USDC, USDT, ARB, and DAI.`,
                    error: `Token not found: ${toToken}`
                  });
                  console.log(
                    "[TOOL:getSwapQuote] Returning to token error:",
                    JSON.stringify(errorResult, null, 2)
                  );
                  return errorResult;
                }

                // Return native currency token info for client-side SDK
                const successResult = toolSuccess({
                  success: true,
                  chain: chainName,
                  chainId,
                  fromToken: nativeCurrency.symbol,
                  toToken: normalizedTo,
                  amount,
                  fromTokenAddress: NATIVE_CURRENCY_ADDRESS, // Special address for native tokens
                  fromTokenDecimals: nativeCurrency.decimals,
                  toTokenAddress: toTokenInfo.address,
                  toTokenDecimals: toTokenInfo.decimals,
                  isNativeCurrency: true, // Flag for client to use postSellNativeCurrencyOrder
                  needsClientQuote: true,
                  message: `Got ${nativeCurrency.symbol} → ${normalizedTo} token details on ${chainName}. I'll fetch a fresh CoW quote next.`
                });
                console.log(
                  "[TOOL:getSwapQuote] Returning native currency success:",
                  JSON.stringify(successResult, null, 2)
                );
                return successResult;
              }

              // Get token information (normal ERC20 flow)
              const fromTokenInfo = await getTokenBySymbol(
                normalizedFrom,
                chainId
              );
              const toTokenInfo = await getTokenBySymbol(normalizedTo, chainId);

              if (!fromTokenInfo) {
                const errorResult = toolError({
                  success: false,
                  userMessage: `I couldn't find ${fromToken} on ${chainName}. Could you double-check the token symbol? If you have the contract address (0x...), I can look it up directly. Popular tokens include WETH, USDC, USDT, ARB, and DAI.`,
                  error: `Token not found: ${fromToken}`
                });
                console.log(
                  "[TOOL:getSwapQuote] Returning from token error:",
                  JSON.stringify(errorResult, null, 2)
                );
                return errorResult;
              }

              if (!toTokenInfo) {
                const errorResult = toolError({
                  success: false,
                  userMessage: `I couldn't find ${toToken} on ${chainName}. Could you double-check the token symbol? If you have the contract address (0x...), I can look it up directly. Popular tokens include WETH, USDC, USDT, ARB, and DAI.`,
                  error: `Token not found: ${toToken}`
                });
                console.log(
                  "[TOOL:getSwapQuote] Returning to token error:",
                  JSON.stringify(errorResult, null, 2)
                );
                return errorResult;
              }

              // Return token info for client-side SDK to use
              const successResult = toolSuccess({
                success: true,
                chain: chainName,
                chainId,
                fromToken: normalizedFrom,
                toToken: normalizedTo,
                amount,
                fromTokenAddress: fromTokenInfo.address,
                fromTokenDecimals: fromTokenInfo.decimals,
                toTokenAddress: toTokenInfo.address,
                toTokenDecimals: toTokenInfo.decimals,
                needsClientQuote: true,
                message: `Got ${normalizedFrom} → ${normalizedTo} token details on ${chainName}. I'll fetch a fresh CoW quote next.`
              });
              console.log(
                "[TOOL:getSwapQuote] Returning success result:",
                JSON.stringify(successResult, null, 2)
              );
              return successResult;
            } catch (error) {
              console.error("[TOOL:getSwapQuote] Caught exception:", error);
              const exceptionResult = toolError({
                success: false,
                userMessage: "Something went wrong. Want to try again?",
                error: error instanceof Error ? error.message : "Unknown error"
              });
              console.log(
                "[TOOL:getSwapQuote] Returning exception result:",
                JSON.stringify(exceptionResult, null, 2)
              );
              return exceptionResult;
            }
          }
        }),
        createOrder: tool({
          description:
            "Return token information for order creation. The client-side SDK will handle quote, signing, and submission. ONLY call this after: 1) User has seen the quote, 2) User has confirmed they want to proceed (clicked 'Create Order' button or said yes/confirm).",
          inputSchema: z.object({
            fromToken: z.string().describe("The token symbol to swap from"),
            toToken: z.string().describe("The token symbol to swap to"),
            amount: z.string().describe("The amount of input token to swap"),
            chainId: z
              .number()
              .describe(
                "Chain ID - REQUIRED. 1=Ethereum, 56=BNB, 137=Polygon, 8453=Base, 42161=Arbitrum"
              )
          }),
          execute: async ({ fromToken, toToken, amount, chainId }) => {
            console.log("[TOOL:createOrder] Getting token info for order:", {
              fromToken,
              toToken,
              amount,
              chainId,
              walletAddress
            });

            if (!walletAddress) {
              return toolError({
                success: false,
                userMessage: "Please connect your wallet first to create orders.",
                error: "Wallet address not provided"
              });
            }

            try {
              const normalizedFrom = normalizeTokenSymbol(fromToken, chainId);
              const normalizedTo = normalizeTokenSymbol(toToken, chainId);
              const chainName = getChainName(chainId);

              // Check if fromToken is native currency
              if (isNativeCurrency(normalizedFrom, chainId)) {
                console.log("[TOOL:createOrder] Detected native currency:", normalizedFrom);
                const nativeCurrency = getNativeCurrency(chainId)!;

                // Get toToken info
                const toTokenInfo = await getTokenBySymbol(normalizedTo, chainId);
                if (!toTokenInfo) {
                  return toolError({
                    success: false,
                    userMessage: "Token not found. Could you double-check the token symbols or share the contract addresses?",
                    error: "Token lookup failed"
                  });
                }

                // Convert amount to smallest unit
                const sellAmount = formatTokenAmount(
                  amount,
                  nativeCurrency.decimals
                );

                // Return native currency token info for client-side SDK
                return toolSuccess({
                  success: true,
                  chain: chainName,
                  chainId,
                  fromToken: nativeCurrency.symbol,
                  toToken: normalizedTo,
                  amount,
                  fromTokenAddress: NATIVE_CURRENCY_ADDRESS, // Special address for native tokens
                  fromTokenDecimals: nativeCurrency.decimals,
                  toTokenAddress: toTokenInfo.address,
                  toTokenDecimals: toTokenInfo.decimals,
                  sellAmount: sellAmount.toString(),
                  userAddress: walletAddress,
                  isNativeCurrency: true, // Flag for client to use postSellNativeCurrencyOrder
                  needsClientSubmission: true,
                  message: `Ready to swap ${amount} ${nativeCurrency.symbol} for ${normalizedTo}. The client SDK will now fetch a quote and submit your order.`
                });
              }

              // Get token information (normal ERC20 flow)
              const fromTokenInfo = await getTokenBySymbol(
                normalizedFrom,
                chainId
              );
              const toTokenInfo = await getTokenBySymbol(normalizedTo, chainId);

              if (!fromTokenInfo || !toTokenInfo) {
                return toolError({
                  success: false,
                  userMessage: "Token not found. Could you double-check the token symbols or share the contract addresses?",
                  error: "Token lookup failed"
                });
              }

              // Convert amount to smallest unit
              const sellAmount = formatTokenAmount(
                amount,
                fromTokenInfo.decimals
              );

              // Return token info for client-side SDK to use
              return toolSuccess({
                success: true,
                chain: chainName,
                chainId,
                fromToken: normalizedFrom,
                toToken: normalizedTo,
                amount,
                fromTokenAddress: fromTokenInfo.address,
                fromTokenDecimals: fromTokenInfo.decimals,
                toTokenAddress: toTokenInfo.address,
                toTokenDecimals: toTokenInfo.decimals,
                sellAmount: sellAmount.toString(),
                userAddress: walletAddress,
                // Instruction for the client to use SDK
                needsClientSubmission: true,
                message: `Ready to swap ${amount} ${normalizedFrom} for ${normalizedTo}. The client SDK will now fetch a quote and submit your order.`
              });
            } catch (error) {
              console.error("[TOOL:createOrder] Error:", error);
              return toolError({
                success: false,
                userMessage: "Something went wrong. Want to try again?",
                error: error instanceof Error ? error.message : "Unknown error"
              });
            }
          }
        }),
        lookupTokenProfile: tool({
          description:
            "Fetch comprehensive token metadata and market data from CoinGecko. Use this when the user asks about token price, market cap, or contract addresses.",
          inputSchema: z.object({
            symbol: z
              .string()
              .describe("Token symbol or search query, e.g., APEX or WETH"),
            chainId: z
              .number()
              .optional()
              .describe(
                "Optional chain ID to highlight the contract on a specific network (1=Ethereum, 56=BNB, 137=Polygon, 8453=Base, 42161=Arbitrum)"
              )
          }),
          execute: async ({ symbol, chainId }) => {
            const formatUsd = (value?: number | null) => {
              if (typeof value !== "number" || Number.isNaN(value)) {
                return undefined;
              }

              if (value >= 1) {
                return `$${value.toLocaleString("en-US", {
                  maximumFractionDigits: 2
                })}`;
              }

              if (value === 0) {
                return "$0.00";
              }

              return `$${value.toLocaleString("en-US", {
                maximumFractionDigits: 6
              })}`;
            };

            try {
              const details = await getCoinDetailsBySymbol(symbol);

              if (!details) {
                return toolError({
                  success: false,
                  userMessage: `I couldn't find an exact match for "${symbol}". Could you double-check the symbol or share the contract address?`
                });
              }

              const resolvedSymbol = details.symbol
                ? details.symbol.toUpperCase()
                : symbol.toUpperCase();

              const normalizeDescription = (text?: string) => {
                if (!text) return undefined;
                const collapsed = text
                  .replace(/\r?\n+/g, " ")
                  .replace(/\s+/g, " ")
                  .trim();
                if (!collapsed) return undefined;
                return collapsed;
              };

              const description = normalizeDescription(details.description?.en);
              const shortDescription =
                description && description.length > 360
                  ? `${description.slice(0, 357)}...`
                  : description;

              const platformEntries = new Map<
                string,
                {
                  address: string;
                  decimals: number | null;
                  geckoTerminalUrl?: string | null;
                  chainId?: number;
                  chainName: string;
                }
              >();

              const addPlatform = (
                platformId: string,
                address: string,
                decimals: number | null,
                geckoTerminalUrl?: string | null
              ) => {
                if (!address) return;

                const trimmedAddress = address.trim();
                const normalizedAddress =
                  trimmedAddress.startsWith("0x") &&
                  trimmedAddress.length === 42
                    ? trimmedAddress.toLowerCase()
                    : trimmedAddress;

                const mappedChainId = getChainIdForPlatform(platformId);
                const chainName = mappedChainId
                  ? getChainName(mappedChainId)
                  : platformId
                      .split("-")
                      .map(
                        (part) => part.charAt(0).toUpperCase() + part.slice(1)
                      )
                      .join(" ");

                platformEntries.set(platformId, {
                  address: normalizedAddress,
                  decimals,
                  geckoTerminalUrl,
                  chainId: mappedChainId,
                  chainName
                });
              };

              if (details.detail_platforms) {
                for (const [platformId, data] of Object.entries(
                  details.detail_platforms
                )) {
                  if (data?.contract_address) {
                    addPlatform(
                      platformId,
                      data.contract_address,
                      data.decimal_place ?? null,
                      data.geckoterminal_url ?? undefined
                    );
                  }
                }
              }

              if (details.platforms) {
                for (const [platformId, address] of Object.entries(
                  details.platforms
                )) {
                  if (address && !platformEntries.has(platformId)) {
                    addPlatform(platformId, address, null);
                  }
                }
              }

              const contracts = Array.from(platformEntries.entries()).map(
                ([platformId, data]) => ({
                  platformId,
                  ...data
                })
              );

              const preferredContract = chainId
                ? contracts.find((contract) => contract.chainId === chainId) ||
                  null
                : contracts[0] || null;

              const priceUsd =
                details.market_data?.current_price?.usd ?? undefined;
              const marketCapUsd =
                details.market_data?.market_cap?.usd ?? undefined;
              const totalVolumeUsd =
                details.market_data?.total_volume?.usd ?? undefined;
              const priceChange24hPercent =
                details.market_data?.price_change_percentage_24h ?? undefined;

              const messageParts: string[] = [];
              messageParts.push(
                `Found ${details.name} (${resolvedSymbol}) on CoinGecko.`
              );

              if (priceUsd !== undefined) {
                const priceFormatted = formatUsd(priceUsd);
                if (priceFormatted) {
                  messageParts.push(`Last price: ${priceFormatted} USD.`);
                }
              }

              if (marketCapUsd !== undefined) {
                const marketCapFormatted = formatUsd(marketCapUsd);
                if (marketCapFormatted) {
                  messageParts.push(`Market cap: ${marketCapFormatted}.`);
                }
              }

              if (preferredContract) {
                messageParts.push(
                  `Primary contract (${preferredContract.chainName}): ${preferredContract.address}`
                );
              } else if (contracts.length === 0) {
                messageParts.push(
                  "CoinGecko did not list any contract addresses for this token."
                );
              }

              return toolSuccess({
                success: true,
                coingeckoId: details.id,
                name: details.name,
                symbol: resolvedSymbol,
                marketCapRank: details.market_cap_rank ?? undefined,
                priceUsd,
                marketCapUsd,
                totalVolumeUsd,
                priceChange24hPercent,
                description: shortDescription,
                fullDescription: description,
                image:
                  details.image?.large ||
                  details.image?.small ||
                  details.image?.thumb,
                links: {
                  homepage: details.links?.homepage?.filter(Boolean)?.[0],
                  twitter: details.links?.twitter_screen_name
                    ? `https://twitter.com/${details.links.twitter_screen_name}`
                    : undefined,
                  chat: details.links?.chat_url?.filter(Boolean)?.[0],
                  announcement:
                    details.links?.announcement_url?.filter(Boolean)?.[0]
                },
                contracts,
                preferredContract,
                requestedChainId: chainId,
                message: messageParts.join(" ")
              });
            } catch (error) {
              console.error("[TOOL:lookupTokenProfile] Error:", error);
              return toolError({
                success: false,
                userMessage:
                  "I ran into an issue fetching CoinGecko data. Could you try again in a moment?",
                error:
                  error instanceof Error ? error.message : "Unknown error occurred"
              });
            }
          }
        }),
        getTokenInfo: tool({
          description:
            "Get information about a specific token including its address and decimals. Supports tokens on Ethereum, Arbitrum, BNB Chain, Polygon, and Base.",
          inputSchema: z.object({
            symbol: z
              .string()
              .describe("The token symbol (e.g., ARB, WETH, USDC, USDT)"),
            chainId: z
              .number()
              .optional()
              .describe(
                "Chain ID: 1=Ethereum, 56=BNB, 137=Polygon, 8453=Base, 42161=Arbitrum (default: 42161)"
              )
          }),
          execute: async ({ symbol, chainId = 42161 }) => {
            const normalized = normalizeTokenSymbol(symbol, chainId);
            const token = await getTokenBySymbol(normalized, chainId);
            const chainName = getChainName(chainId);

            if (!token) {
              return toolError({
                success: false,
                userMessage: `I couldn't find ${symbol} on ${chainName}. Could you double-check the token symbol or share the contract address?`,
                error: `Token ${symbol} not found on chain ${chainId}. The token may not be available or the symbol may be incorrect.`
              });
            }

            return toolSuccess({
              success: true,
              symbol: token.symbol,
              name: token.name,
              address: token.address,
              decimals: token.decimals,
              chainId: token.chainId,
              message: `${token.name} (${token.symbol}) is available on ${chainName}. Contract: ${token.address}, decimals: ${token.decimals}.`
            });
          }
        }),
        getTokenUSDPrice: tool({
          description:
            "Get the current USD price of a token. Use this when user asks for price without specifying the quote token (defaults to USD). ONLY call when you have confirmed the token symbol AND chainId. Do NOT assume defaults.",
          inputSchema: z.object({
            token: z
              .string()
              .describe(
                "The token to get USD price for (e.g., ARB, WETH, USDC) - REQUIRED"
              ),
            chainId: z
              .number()
              .describe(
                "Chain ID - REQUIRED, must be explicitly provided by user. 1=Ethereum, 56=BNB, 137=Polygon, 8453=Base, 42161=Arbitrum. NO DEFAULT - always ask if not specified"
              )
          }),
          execute: async ({ token, chainId }) => {
            try {
              const normalized = normalizeTokenSymbol(token, chainId);
              const chainName = getChainName(chainId);

              // Check if this is a native currency (ETH, BNB, MATIC/POL/POLYGON)
              if (isNativeCurrency(normalized, chainId)) {
                console.log("[TOOL:getTokenUSDPrice] Detected native currency:", normalized);
                const nativeCurrency = getNativeCurrency(chainId)!;

                // Map native currency symbols to CoinGecko coin IDs
                // We directly use the coin ID to fetch details (no search API needed)
                const coinGeckoIdMap: Record<string, string> = {
                  'ETH': 'ethereum',
                  'BNB': 'binancecoin',
                  'MATIC': 'polygon-ecosystem-token',
                  'POL': 'polygon-ecosystem-token',
                  'POLYGON': 'polygon-ecosystem-token'
                };

                const coinGeckoId = coinGeckoIdMap[nativeCurrency.symbol];
                if (!coinGeckoId) {
                  return toolError({
                    success: false,
                    userMessage: `I don't have price data for ${nativeCurrency.symbol} yet. Want to try a different token?`,
                    error: `No CoinGecko ID mapping for ${nativeCurrency.symbol}`
                  });
                }

                try {
                  // Use the existing CoinGecko helper to fetch coin details
                  const { getCoinDetails } = await import("@/lib/coingecko");
                  const coinDetails = await getCoinDetails(coinGeckoId);

                  if (!coinDetails) {
                    return toolError({
                      success: false,
                      userMessage: `I couldn't fetch price data for ${nativeCurrency.symbol} from CoinGecko. Want to try again?`,
                      error: "CoinGecko returned null"
                    });
                  }

                  const usdPrice = coinDetails.market_data?.current_price?.usd;

                  if (typeof usdPrice !== 'number') {
                    return toolError({
                      success: false,
                      userMessage: `I couldn't find current USD price for ${nativeCurrency.symbol}. Want to try again?`,
                      error: "USD price not available in CoinGecko response"
                    });
                  }

                  // Format price with appropriate decimals
                  const formattedPrice = usdPrice >= 1
                    ? usdPrice.toFixed(2)
                    : usdPrice.toFixed(6);

                  console.log(`[TOOL:getTokenUSDPrice] ${nativeCurrency.symbol} price from CoinGecko:`, formattedPrice);

                  return toolSuccess({
                    success: true,
                    chain: chainName,
                    chainId,
                    token: nativeCurrency.symbol,
                    price: formattedPrice,
                    priceNumber: usdPrice,
                    tokenAddress: NATIVE_CURRENCY_ADDRESS,
                    message: `${nativeCurrency.symbol} is currently $${formattedPrice} USD on ${chainName}`
                  });
                } catch (geckoError) {
                  console.error("[TOOL:getTokenUSDPrice] CoinGecko error:", geckoError);
                  return toolError({
                    success: false,
                    userMessage: `Having trouble fetching ${nativeCurrency.symbol} price from CoinGecko. Want to try again?`,
                    error: geckoError instanceof Error ? geckoError.message : "CoinGecko API failed"
                  });
                }
              }

              // For ERC-20 tokens, use the existing price API
              const result = await getTokenUSDPrice(normalized, chainId);

              if (!result.success) {
                return toolError({
                  success: false,
                  userMessage:
                    result.userMessage ||
                    `I'm having trouble finding a USD price for ${normalized} on ${chainName}. Want to try another token or chain?`,
                  error: result.error || "Failed to get USD price"
                });
              }

              const displayToken = result.symbol || normalized;

              return toolSuccess({
                success: true,
                chain: chainName,
                chainId,
                token: displayToken,
                price: result.price,
                priceNumber: result.priceNumber,
                tokenAddress: result.tokenAddress,
                message: `${displayToken} is currently $${result.price} USD on ${chainName}`
              });
            } catch (error) {
              return toolError({
                success: false,
                userMessage:
                  "Having trouble getting the price right now. Want to try again?",
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to get USD price"
              });
            }
          }
        }),
        getWalletBalances: tool({
          description:
            "Get all token balances (portfolio) in user's wallet. Use when user wants to see ALL their tokens or their portfolio. Supports filtering and limits.",
          inputSchema: z.object({
            chainId: z
              .number()
              .describe(
                "Chain ID - REQUIRED. 1=Ethereum, 56=BNB, 137=Polygon, 8453=Base, 42161=Arbitrum. Ask user if not specified."
              ),
            minUsdValue: z
              .number()
              .optional()
              .describe(
                "Minimum USD value filter (e.g., 1 means only show tokens worth $1 or more)"
              ),
            maxResults: z
              .number()
              .optional()
              .describe(
                "Maximum number of results to return (default: 20, useful for 'show top 10 tokens')"
              )
          }),
          execute: async ({ chainId, minUsdValue, maxResults = 20 }) => {
            console.log("[TOOL:getWalletBalances] Fetching wallet balances:", {
              chainId,
              walletAddress,
              minUsdValue,
              maxResults
            });

            if (!walletAddress) {
              return toolError({
                success: false,
                userMessage:
                  "I don't have access to your wallet address. Please refresh the page and try again.",
                error: "Wallet address not provided in request headers"
              });
            }

            try {
              const chainName = getChainName(chainId);

              const viemChain = getViemChain(chainId);
              if (!viemChain) {
                return toolError({
                  success: false,
                  userMessage: `I don't currently support wallet balance lookups on chain ${chainId}.`,
                  error: `Unsupported chain: ${chainId}`
                });
              }

              const publicClient = createPublicClient({
                chain: viemChain,
                transport: http()
              });

              // Import balance utilities
              const {
                getAllTokenBalances,
                calculatePortfolioValue,
                formatTokenBalance
              } = await import("@/lib/wallet-balances");

              // Fetch all balances
              const balances = await getAllTokenBalances(
                publicClient,
                walletAddress as Address,
                chainId,
                {
                  includeZeroBalances: false,
                  minUsdValue,
                  maxResults
                }
              );

              if (balances.length === 0) {
                return toolError({
                  success: false,
                  userMessage: `No tokens found in your wallet on ${chainName}${
                    minUsdValue ? ` with value >= $${minUsdValue}` : ""
                  }.`,
                  error: "No balances found"
                });
              }

              // Calculate total portfolio value
              const totalValue = calculatePortfolioValue(balances);

              // Format balances for display
              const formattedBalances = balances.map((b) => ({
                symbol: b.token.symbol,
                name: b.token.name,
                balance: b.balance,
                usdValue: b.usdValue,
                usdPrice: b.usdPrice,
                formatted: formatTokenBalance(b)
              }));

              return toolSuccess({
                success: true,
                chain: chainName,
                chainId,
                balances: formattedBalances,
                totalValue,
                count: balances.length,
                message: `Found ${balances.length} tokens${
                  minUsdValue ? ` worth $${minUsdValue}+ each` : ""
                }. Total portfolio value: $${totalValue.toFixed(2)}`
              });
            } catch (error) {
              console.error("[TOOL:getWalletBalances] Error:", error);
              return toolError({
                success: false,
                userMessage:
                  "Having trouble fetching your balances. Want to try again?",
                error: error instanceof Error ? error.message : "Unknown error"
              });
            }
          }
        }),
        getSpecificBalances: tool({
          description:
            "Get balance for ONE or MORE specific tokens. Use when user asks about specific token(s), not their entire portfolio. Accepts symbols OR contract addresses.",
          inputSchema: z.object({
            tokens: z
              .array(z.string())
              .describe(
                "Array of token symbols OR contract addresses to check (e.g., ['USDC', 'ARB'] or ['0x123...', '0x456...'])"
              ),
            chainId: z
              .number()
              .describe(
                "Chain ID - REQUIRED. 1=Ethereum, 56=BNB, 137=Polygon, 8453=Base, 42161=Arbitrum. Ask user if not specified."
              )
          }),
          execute: async ({ tokens, chainId }) => {
            console.log(
              "[TOOL:getSpecificBalances] Fetching specific balances:",
              {
                tokens,
                chainId,
                walletAddress
              }
            );

            if (!walletAddress) {
              return toolError({
                success: false,
                userMessage:
                  "I don't have access to your wallet address. Please refresh the page and try again.",
                error: "Wallet address not provided in request headers"
              });
            }

            try {
              const chainName = getChainName(chainId);

              const viemChain = getViemChain(chainId);
              if (!viemChain) {
                return toolError({
                  success: false,
                  userMessage: `I don't currently support balance lookups on chain ${chainId}.`,
                  error: `Unsupported chain: ${chainId}`
                });
              }

              const publicClient = createPublicClient({
                chain: viemChain,
                transport: http()
              });

              // Import token lookup functions
              const { getTokenBySymbol, getTokenByAddress } = await import(
                "@/lib/tokens"
              );

              // Get token info for all requested tokens (support both symbols and addresses)
              const tokenInfos = await Promise.all(
                tokens.map(async (input) => {
                  // Check if input is a contract address (starts with 0x and is 42 chars)
                  if (input.startsWith("0x") && input.length === 42) {
                    console.log(
                      `[TOKENS] Looking up token by address: ${input}`
                    );
                    return await getTokenByAddress(input, chainId);
                  } else {
                    // Treat as symbol
                    const normalized = normalizeTokenSymbol(input, chainId);
                    return await getTokenBySymbol(normalized, chainId);
                  }
                })
              );

              // Filter out tokens that weren't found and track which ones failed
              const validTokens = tokenInfos.filter(
                (t): t is NonNullable<typeof t> => t !== undefined
              );

              if (validTokens.length === 0) {
                const tokenList = tokens.join(", ");
                return toolError({
                  success: false,
                  userMessage: `I couldn't find ${tokenList} on ${chainName}. Could you double-check the token symbol? If you have the token contract address, I can look it up directly for you. Otherwise, try a different token like WETH, USDC, or USDT.`,
                  error: "Tokens not found"
                });
              }

              // If some tokens were found but not all, let the user know
              const missingTokens = tokens.filter(
                (symbol, i) => !tokenInfos[i]
              );
              const foundTokenSymbols = validTokens
                .map((t) => t.symbol)
                .join(", ");

              // Import balance utilities
              const { getSpecificTokenBalances, formatTokenBalance } =
                await import("@/lib/wallet-balances");

              // Fetch balances
              const balances = await getSpecificTokenBalances(
                publicClient,
                walletAddress as Address,
                validTokens
              );

              // Format balances for display
              const formattedBalances = balances.map((b) => ({
                symbol: b.token.symbol,
                name: b.token.name,
                balance: b.balance,
                usdValue: b.usdValue,
                usdPrice: b.usdPrice,
                formatted: formatTokenBalance(b)
              }));

              // Build a helpful message
              let message = `Found balances for ${foundTokenSymbols} on ${chainName}`;
              if (missingTokens.length > 0) {
                message += `. Note: I couldn't find ${missingTokens.join(
                  ", "
                )} - please verify the symbol or provide the contract address.`;
              }

              // If this is a single token query, format as text response instead of table
              const isSingleToken =
                formattedBalances.length === 1 && tokens.length === 1;

              if (isSingleToken) {
                const bal = formattedBalances[0];
                const balanceText = `Your ${bal.symbol} balance is ${parseFloat(
                  bal.balance
                ).toFixed(6)} ${bal.symbol}`;
                const usdText =
                  bal.usdValue !== undefined
                    ? `, which is equivalent to $${bal.usdValue.toFixed(2)} USD`
                    : "";

                return toolSuccess({
                  success: true,
                  chain: chainName,
                  chainId,
                  // Don't send balances array for single token - this prevents UI table from showing
                  singleTokenResponse: true,
                  message: balanceText + usdText,
                  tokenDetails: {
                    symbol: bal.symbol,
                    name: bal.name,
                    balance: bal.balance, // Available for AI to use in next tool call
                    usdValue: bal.usdValue,
                    usdPrice: bal.usdPrice
                  },
                  // Make it clear this is intermediate data for multi-step flows
                  continueWithSwap: {
                    availableAmount: bal.balance,
                    token: bal.symbol
                  }
                });
              }

              return toolSuccess({
                success: true,
                chain: chainName,
                chainId,
                balances: formattedBalances,
                message,
                warning:
                  missingTokens.length > 0
                    ? `Could not find: ${missingTokens.join(", ")}`
                    : undefined
              });
            } catch (error) {
              console.error("[TOOL:getSpecificBalances] Error:", error);
              return toolError({
                success: false,
                userMessage:
                  "Having trouble fetching balances. Want to try again?",
                error: error instanceof Error ? error.message : "Unknown error"
              });
            }
          }
        }),
        getSwapQuoteForEntireBalance: tool({
          description:
            "Get a swap quote for the user's ENTIRE balance of a token. Use this ONLY when user explicitly says 'swap my whole/all/entire balance'. Returns token info and triggers client-side balance fetch + quote.",
          inputSchema: z.object({
            fromToken: z
              .string()
              .describe("The token to swap FROM (e.g., USDC, ARB)"),
            toToken: z
              .string()
              .describe("The token to swap TO (e.g., ARB, USDC)"),
            chainId: z
              .number()
              .describe(
                "Chain ID - REQUIRED. 1=Ethereum, 56=BNB, 137=Polygon, 8453=Base, 42161=Arbitrum"
              )
          }),
          execute: async ({ fromToken, toToken, chainId }) => {
            console.log(
              "[TOOL:getSwapQuoteForEntireBalance] Getting token info for entire balance swap:",
              {
                fromToken,
                toToken,
                chainId,
                walletAddress
              }
            );

            if (!walletAddress) {
              return toolError({
                success: false,
                userMessage: "Please connect your wallet first.",
                error: "Wallet address not provided"
              });
            }

            try {
              const chainName = getChainName(chainId);
              const normalizedFrom = normalizeTokenSymbol(fromToken, chainId);
              const normalizedTo = normalizeTokenSymbol(toToken, chainId);

              // Get token information for both tokens
              const { getTokenBySymbol } = await import("@/lib/tokens");

              // Check if fromToken is native currency
              if (isNativeCurrency(normalizedFrom, chainId)) {
                console.log("[TOOL:getSwapQuoteForEntireBalance] Detected native currency:", normalizedFrom);
                const nativeCurrency = getNativeCurrency(chainId)!;

                const toTokenInfo = await getTokenBySymbol(normalizedTo, chainId);
                if (!toTokenInfo) {
                  return toolError({
                    success: false,
                    userMessage: `I couldn't find ${toToken} on ${chainName}. Could you double-check the token symbol?`,
                    error: `Token not found: ${toToken}`
                  });
                }

                // Return native currency token info - client will fetch balance and quote
                return toolSuccess({
                  success: true,
                  chain: chainName,
                  chainId,
                  fromToken: nativeCurrency.symbol,
                  toToken: normalizedTo,
                  fromTokenAddress: NATIVE_CURRENCY_ADDRESS,
                  fromTokenDecimals: nativeCurrency.decimals,
                  toTokenAddress: toTokenInfo.address,
                  toTokenDecimals: toTokenInfo.decimals,
                  isNativeCurrency: true,
                  needsClientBalanceFetch: true,
                  needsClientQuote: true,
                  message: `Checking your ${nativeCurrency.symbol} balance on ${chainName}...`
                });
              }

              const fromTokenInfo = await getTokenBySymbol(
                normalizedFrom,
                chainId
              );

              if (!fromTokenInfo) {
                return toolError({
                  success: false,
                  userMessage: `I couldn't find ${fromToken} on ${chainName}. Could you double-check the token symbol?`,
                  error: `Token not found: ${fromToken}`
                });
              }

              const toTokenInfo = await getTokenBySymbol(normalizedTo, chainId);
              if (!toTokenInfo) {
                return toolError({
                  success: false,
                  userMessage: `I couldn't find ${toToken} on ${chainName}. Could you double-check the token symbol?`,
                  error: `Token not found: ${toToken}`
                });
              }

              // Return token info - client will fetch balance and quote
              return toolSuccess({
                success: true,
                chain: chainName,
                chainId,
                fromToken: normalizedFrom,
                toToken: normalizedTo,
                fromTokenAddress: fromTokenInfo.address,
                fromTokenDecimals: fromTokenInfo.decimals,
                toTokenAddress: toTokenInfo.address,
                toTokenDecimals: toTokenInfo.decimals,
                needsClientBalanceFetch: true, // Tells client to fetch balance first
                needsClientQuote: true, // Then fetch quote with that balance
                message: `Checking your ${normalizedFrom} balance on ${chainName}...`
              });
            } catch (error) {
              console.error(
                "[TOOL:getSwapQuoteForEntireBalance] Error:",
                error
              );
              return toolError({
                success: false,
                userMessage: "Something went wrong. Want to try again?",
                error: error instanceof Error ? error.message : "Unknown error"
              });
            }
          }
        })
      }
    });

    console.log("[API] Streaming response to client...");
    const response = result.toUIMessageStreamResponse();
    console.log("[API] Response created, returning to client");
    return response;
  } catch (error) {
    console.error("[API] ❌ ERROR in streamText:", error);
    console.error("[API] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    // Return error response
    return new Response(
      JSON.stringify({
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
