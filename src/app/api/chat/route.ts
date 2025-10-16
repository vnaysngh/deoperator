import { openai } from "@ai-sdk/openai";
import { streamText, tool, convertToModelMessages, UIMessage } from "ai";
import { z } from "zod";
import {
  getTokenBySymbol,
  normalizeTokenSymbol,
  formatTokenAmount
} from "@/lib/tokens";
import { getTokenUSDPrice } from "@/lib/sushiswap";
import { getChainName } from "@/lib/chains";
import { createPublicClient, http, type Address } from "viem";
import { arbitrum, bsc } from "viem/chains";

export const maxDuration = 30;

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
      - Arbitrum (chainId: 42161) ✅
      - BNB Chain (chainId: 56) ✅

      ⚠️ Currently NOT Supported:
      - Ethereum, Polygon, Unichain - Coming soon! Currently only Arbitrum and BNB Chain are supported.

      Token Support:
      - Supports 1,200+ verified tokens through Uniswap token lists
      - Popular tokens: WETH, USDC, USDT, DAI, WBTC, UNI, LINK, AAVE, APE (ApeCoin), PEPE, SHIB, SOL (bridged), etc.
      - Chain-specific tokens: ARB (Arbitrum), MATIC (Polygon), WBNB/BTCB (BNB Chain)
      - Bridged tokens: Many tokens exist as bridged versions on multiple chains (e.g., SOL on BNB Chain, AVAX on Ethereum)

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
      - If user says "arbitrum" or "ARB" → chainId: 42161
      - If user says "bnb" or "bsc" or "binance" → chainId: 56
      - If user says "ethereum", "polygon", "unichain" → Politely explain it's not yet supported, suggest Arbitrum or BNB Chain

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
        getSwapQuote: tool({
          description:
            "Get token information for a swap. Returns token addresses and decimals. The client-side SDK will fetch the actual quote. ONLY call this when you have confirmed: fromToken, toToken, amount, AND chainId with the user. Do NOT assume defaults. Only supports Arbitrum (42161) and BNB Chain (56).",
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
                "Chain ID - REQUIRED, must be explicitly provided by user. 42161=Arbitrum, 56=BNB. NO DEFAULT - always ask if not specified"
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

              // Get token information
              const fromTokenInfo = await getTokenBySymbol(
                normalizedFrom,
                chainId
              );
              const toTokenInfo = await getTokenBySymbol(normalizedTo, chainId);

              if (!fromTokenInfo) {
                const errorResult = {
                  success: false,
                  userMessage: `I couldn't find ${fromToken} on ${chainName}. Could you double-check the token symbol? If you have the contract address (0x...), I can look it up directly. Popular tokens include WETH, USDC, USDT, ARB, and DAI.`,
                  error: `Token not found: ${fromToken}`
                };
                console.log(
                  "[TOOL:getSwapQuote] Returning from token error:",
                  JSON.stringify(errorResult, null, 2)
                );
                return errorResult;
              }

              if (!toTokenInfo) {
                const errorResult = {
                  success: false,
                  userMessage: `I couldn't find ${toToken} on ${chainName}. Could you double-check the token symbol? If you have the contract address (0x...), I can look it up directly. Popular tokens include WETH, USDC, USDT, ARB, and DAI.`,
                  error: `Token not found: ${toToken}`
                };
                console.log(
                  "[TOOL:getSwapQuote] Returning to token error:",
                  JSON.stringify(errorResult, null, 2)
                );
                return errorResult;
              }

              // Try to fetch a quote from CoW Protocol to check if there's liquidity
              // This is a server-side check to catch liquidity issues early
              try {
                const { parseUnits } = await import("viem");
                const sellAmount = parseUnits(amount, fromTokenInfo.decimals);

                // Make a basic quote request to CoW API to check liquidity
                const quoteUrl = `https://api.cow.fi/${
                  chainId === 42161
                    ? "arbitrum_one"
                    : chainId === 56
                    ? "bsc"
                    : "mainnet"
                }/api/v1/quote`;

                const quoteResponse = await fetch(quoteUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sellToken: fromTokenInfo.address,
                    buyToken: toTokenInfo.address,
                    sellAmountBeforeFee: sellAmount.toString(),
                    from: "0x0000000000000000000000000000000000000000", // Dummy address for quote check
                    kind: "sell",
                    priceQuality: "fast"
                  })
                });

                if (!quoteResponse.ok) {
                  const errorText = await quoteResponse.text();
                  console.log(
                    "[TOOL:getSwapQuote] Quote check failed:",
                    quoteResponse.status,
                    errorText
                  );

                  // Check if it's a liquidity issue
                  if (
                    errorText.toLowerCase().includes("liquidity") ||
                    quoteResponse.status === 404
                  ) {
                    const errorMessage = `There isn't enough liquidity to swap ${amount} ${normalizedFrom} for ${normalizedTo} on ${chainName}. Try using a smaller amount or different tokens.`;
                    console.log(
                      "[TOOL:getSwapQuote] Returning liquidity error:",
                      errorMessage
                    );
                    const liquidityErrorResult = {
                      success: false,
                      userMessage: errorMessage,
                      error: "Insufficient liquidity"
                    };
                    console.log(
                      "[TOOL:getSwapQuote] Liquidity error result:",
                      JSON.stringify(liquidityErrorResult, null, 2)
                    );
                    return liquidityErrorResult;
                  }
                }
              } catch (liquidityCheckError) {
                console.log(
                  "[TOOL:getSwapQuote] Liquidity check failed, continuing anyway:",
                  liquidityCheckError
                );
                // Continue anyway - the client-side SDK will handle it
              }

              // Return token info for client-side SDK to use
              const successResult = {
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
                // Instruction for the client to fetch quote
                needsClientQuote: true
              };
              console.log(
                "[TOOL:getSwapQuote] Returning success result:",
                JSON.stringify(successResult, null, 2)
              );
              return successResult;
            } catch (error) {
              console.error("[TOOL:getSwapQuote] Caught exception:", error);
              const exceptionResult = {
                success: false,
                userMessage: "Something went wrong. Want to try again?",
                error: error instanceof Error ? error.message : "Unknown error"
              };
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
              .describe("Chain ID - REQUIRED. 42161=Arbitrum, 56=BNB")
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
              return {
                success: false,
                userMessage:
                  "Please connect your wallet first to create orders.",
                error: "Wallet address not provided"
              };
            }

            try {
              const normalizedFrom = normalizeTokenSymbol(fromToken, chainId);
              const normalizedTo = normalizeTokenSymbol(toToken, chainId);
              const chainName = getChainName(chainId);

              // Get token information
              const fromTokenInfo = await getTokenBySymbol(
                normalizedFrom,
                chainId
              );
              const toTokenInfo = await getTokenBySymbol(normalizedTo, chainId);

              if (!fromTokenInfo || !toTokenInfo) {
                return {
                  success: false,
                  userMessage: "Token not found",
                  error: "Token lookup failed"
                };
              }

              // Convert amount to smallest unit
              const sellAmount = formatTokenAmount(
                amount,
                fromTokenInfo.decimals
              );

              // Return token info for client-side SDK to use
              return {
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
              };
            } catch (error) {
              console.error("[TOOL:createOrder] Error:", error);
              return {
                success: false,
                userMessage: "Something went wrong. Want to try again?",
                error: error instanceof Error ? error.message : "Unknown error"
              };
            }
          }
        }),
        getTokenInfo: tool({
          description:
            "Get information about a specific token including its address and decimals. Supports tokens on Arbitrum and BNB Chain.",
          inputSchema: z.object({
            symbol: z
              .string()
              .describe("The token symbol (e.g., ARB, WETH, USDC, USDT)"),
            chainId: z
              .number()
              .optional()
              .describe("Chain ID: 42161=Arbitrum, 56=BNB (default: 42161)")
          }),
          execute: async ({ symbol, chainId = 42161 }) => {
            const normalized = normalizeTokenSymbol(symbol, chainId);
            const token = await getTokenBySymbol(normalized, chainId);

            if (!token) {
              return {
                success: false,
                error: `Token ${symbol} not found on chain ${chainId}. The token may not be available or the symbol may be incorrect.`
              };
            }

            return {
              success: true,
              symbol: token.symbol,
              name: token.name,
              address: token.address,
              decimals: token.decimals,
              chainId: token.chainId
            };
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
                "Chain ID - REQUIRED, must be explicitly provided by user. 42161=Arbitrum, 56=BNB. NO DEFAULT - always ask if not specified"
              )
          }),
          execute: async ({ token, chainId }) => {
            try {
              const normalized = normalizeTokenSymbol(token, chainId);
              const chainName = getChainName(chainId);

              const result = await getTokenUSDPrice(normalized, chainId);

              if (!result.success) {
                return {
                  success: false,
                  // Return user-friendly message if available, otherwise use technical error
                  userMessage: result.userMessage,
                  error: result.error || "Failed to get USD price"
                };
              }

              const displayToken = result.symbol || normalized;

              return {
                success: true,
                chain: chainName,
                chainId,
                token: displayToken,
                price: result.price,
                priceNumber: result.priceNumber,
                tokenAddress: result.tokenAddress,
                message: `${displayToken} is currently $${result.price} USD on ${chainName}`
              };
            } catch (error) {
              return {
                success: false,
                userMessage:
                  "Having trouble getting the price right now. Want to try again?",
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to get USD price"
              };
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
                "Chain ID - REQUIRED. 42161=Arbitrum, 56=BNB. Ask user if not specified."
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
              return {
                success: false,
                userMessage:
                  "I don't have access to your wallet address. Please refresh the page and try again.",
                error: "Wallet address not provided in request headers"
              };
            }

            try {
              const chainName = getChainName(chainId);

              // Create public client for the chain
              const chain = chainId === 42161 ? arbitrum : bsc;
              const publicClient = createPublicClient({
                chain,
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
                return {
                  success: false,
                  userMessage: `No tokens found in your wallet on ${chainName}${
                    minUsdValue ? ` with value >= $${minUsdValue}` : ""
                  }.`,
                  error: "No balances found"
                };
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

              return {
                success: true,
                chain: chainName,
                chainId,
                balances: formattedBalances,
                totalValue,
                count: balances.length,
                message: `Found ${balances.length} tokens${
                  minUsdValue ? ` worth $${minUsdValue}+ each` : ""
                }. Total portfolio value: $${totalValue.toFixed(2)}`
              };
            } catch (error) {
              console.error("[TOOL:getWalletBalances] Error:", error);
              return {
                success: false,
                userMessage:
                  "Having trouble fetching your balances. Want to try again?",
                error: error instanceof Error ? error.message : "Unknown error"
              };
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
                "Chain ID - REQUIRED. 42161=Arbitrum, 56=BNB. Ask user if not specified."
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
              return {
                success: false,
                userMessage:
                  "I don't have access to your wallet address. Please refresh the page and try again.",
                error: "Wallet address not provided in request headers"
              };
            }

            try {
              const chainName = getChainName(chainId);

              // Create public client for the chain
              const chain = chainId === 42161 ? arbitrum : bsc;
              const publicClient = createPublicClient({
                chain,
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
                return {
                  success: false,
                  userMessage: `I couldn't find ${tokenList} on ${chainName}. Could you double-check the token symbol? If you have the token contract address, I can look it up directly for you. Otherwise, try a different token like WETH, USDC, or USDT.`,
                  error: "Tokens not found"
                };
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

                return {
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
                };
              }

              return {
                success: true,
                chain: chainName,
                chainId,
                balances: formattedBalances,
                message,
                warning:
                  missingTokens.length > 0
                    ? `Could not find: ${missingTokens.join(", ")}`
                    : undefined
              };
            } catch (error) {
              console.error("[TOOL:getSpecificBalances] Error:", error);
              return {
                success: false,
                userMessage:
                  "Having trouble fetching balances. Want to try again?",
                error: error instanceof Error ? error.message : "Unknown error"
              };
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
              .describe("Chain ID - REQUIRED. 42161=Arbitrum, 56=BNB")
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
              return {
                success: false,
                userMessage: "Please connect your wallet first.",
                error: "Wallet address not provided"
              };
            }

            try {
              const chainName = getChainName(chainId);
              const normalizedFrom = normalizeTokenSymbol(fromToken, chainId);
              const normalizedTo = normalizeTokenSymbol(toToken, chainId);

              // Get token information for both tokens
              const { getTokenBySymbol } = await import("@/lib/tokens");
              const fromTokenInfo = await getTokenBySymbol(
                normalizedFrom,
                chainId
              );

              if (!fromTokenInfo) {
                return {
                  success: false,
                  userMessage: `I couldn't find ${fromToken} on ${chainName}. Could you double-check the token symbol?`,
                  error: `Token not found: ${fromToken}`
                };
              }

              const toTokenInfo = await getTokenBySymbol(normalizedTo, chainId);
              if (!toTokenInfo) {
                return {
                  success: false,
                  userMessage: `I couldn't find ${toToken} on ${chainName}. Could you double-check the token symbol?`,
                  error: `Token not found: ${toToken}`
                };
              }

              // Return token info - client will fetch balance and quote
              return {
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
              };
            } catch (error) {
              console.error(
                "[TOOL:getSwapQuoteForEntireBalance] Error:",
                error
              );
              return {
                success: false,
                userMessage: "Something went wrong. Want to try again?",
                error: error instanceof Error ? error.message : "Unknown error"
              };
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
