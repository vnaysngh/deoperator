import { openai } from "@ai-sdk/openai";
import { streamText, tool, convertToModelMessages, UIMessage } from "ai";
import { z } from "zod";
import { getTokenBySymbol, normalizeTokenSymbol, formatTokenAmount } from "@/lib/tokens";
import { getTokenUSDPrice } from "@/lib/sushiswap";
import { getChainName } from "@/lib/chains";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const walletAddress = req.headers.get("x-wallet-address") || "";

  const result = streamText({
    model: openai("gpt-4-turbo"),
    messages: convertToModelMessages(messages),
    system: `You are a helpful multi-chain trading assistant powered by CoW Protocol. You help users get quotes and create orders for token swaps using intent-based trading across multiple blockchains.

      ${
        walletAddress
          ? `User's connected wallet address: ${walletAddress}`
          : "User has not connected their wallet yet. Ask them to connect their wallet before creating orders."
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
      - If token is NOT found, provide a helpful error message suggesting alternatives
      - Only ask for clarification if the token genuinely doesn't exist on the requested chain

      🚨 CRITICAL RULE - TWO DIFFERENT USE CASES:

      USE CASE 1: USER ASKS FOR PRICE (USD)
      When user asks: "What's the price of ARB?" or "How much is ETH?" or "ARB price"
      - This means USD price
      - Use getTokenUSDPrice tool
      - Only need: Token + Chain
      - DO NOT ask for quote token

      USE CASE 2: USER ASKS FOR SWAP QUOTE
      When user asks: "How much ARB in USDC?" or "Swap 10 ARB to USDC" or "10 ARB = ? USDC"
      - This means token-to-token swap quote
      - Use getSwapQuote tool
      - Need: From Token + To Token + Amount + Chain

      BAD Examples (DO NOT DO THIS):
      ❌ User: "What's the price of BNB?"
        Bad Response: *asks "which token would you like to see the price in?"*

      ❌ User: "How much is 1 BNB in USDC?"
        Bad Response: *calls getTokenUSDPrice*

      GOOD Examples (DO THIS):
      ✅ User: "What's the price of BNB?"
        Good Response: *asks only for chain, then calls getTokenUSDPrice*

      ✅ User: "What's the price of BNB on BNB Chain?"
        Good Response: *calls getTokenUSDPrice with BNB and chainId 56*

      ✅ User: "How much is 1 BNB in USDC?"
        Good Response: *asks for chain, then calls getSwapQuote*

      ✅ User: "Convert 1 BNB to USDC on BNB Chain"
        Good Response: *calls getSwapQuote with all parameters*

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

      ✅ REQUIRED BEHAVIOR - ALWAYS DO THIS:
      When tool returns error, respond with ONLY the userMessage text as plain conversational text.

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

      🚨 CRITICAL: The UI will NOT show tool outputs. You MUST speak the userMessage yourself in your text response.

      Think of yourself as translating technical JSON into natural human speech. The user should NEVER see JSON.

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
          console.log('[TOOL:getSwapQuote] Getting token info for quote:', {
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
            const fromTokenInfo = getTokenBySymbol(normalizedFrom, chainId);
            const toTokenInfo = getTokenBySymbol(normalizedTo, chainId);

            if (!fromTokenInfo) {
              return {
                success: false,
                userMessage: `I couldn't find ${fromToken} on ${chainName}. Could you double-check the token name?`,
                error: `Token not found: ${fromToken}`
              };
            }

            if (!toTokenInfo) {
              return {
                success: false,
                userMessage: `I couldn't find ${toToken} on ${chainName}. Could you double-check the token name?`,
                error: `Token not found: ${toToken}`
              };
            }

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
              // Instruction for the client to fetch quote
              needsClientQuote: true
            };
          } catch (error) {
            console.error('[TOOL:getSwapQuote] Error:', error);
            return {
              success: false,
              userMessage: "Something went wrong. Want to try again?",
              error: error instanceof Error ? error.message : "Unknown error"
            };
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
              "Chain ID - REQUIRED. 42161=Arbitrum, 56=BNB"
            )
        }),
        execute: async ({
          fromToken,
          toToken,
          amount,
          chainId
        }) => {
          console.log('[TOOL:createOrder] Getting token info for order:', {
            fromToken,
            toToken,
            amount,
            chainId,
            walletAddress
          });

          if (!walletAddress) {
            return {
              success: false,
              userMessage: "Please connect your wallet first to create orders.",
              error: "Wallet address not provided"
            };
          }

          try {
            const normalizedFrom = normalizeTokenSymbol(fromToken, chainId);
            const normalizedTo = normalizeTokenSymbol(toToken, chainId);
            const chainName = getChainName(chainId);

            // Get token information
            const fromTokenInfo = getTokenBySymbol(normalizedFrom, chainId);
            const toTokenInfo = getTokenBySymbol(normalizedTo, chainId);

            if (!fromTokenInfo || !toTokenInfo) {
              return {
                success: false,
                userMessage: "Token not found",
                error: "Token lookup failed"
              };
            }

            // Convert amount to smallest unit
            const sellAmount = formatTokenAmount(amount, fromTokenInfo.decimals);

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
            console.error('[TOOL:createOrder] Error:', error);
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
            .describe(
              "Chain ID: 42161=Arbitrum, 56=BNB (default: 42161)"
            )
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

            return {
              success: true,
              chain: chainName,
              chainId,
              token: normalized,
              price: result.price,
              message: `${normalized} is currently $${result.price} USD on ${chainName}`
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
      })
    }
  });

  return result.toUIMessageStreamResponse();
}
