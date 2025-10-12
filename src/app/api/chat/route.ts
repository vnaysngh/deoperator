import { openai } from "@ai-sdk/openai";
import { streamText, tool, convertToModelMessages, UIMessage } from "ai";
import { z } from "zod";
import { getTokenBySymbol, normalizeTokenSymbol } from "@/lib/tokens";
import { getSushiSwapQuote, getSushiSwapPrice, getTokenUSDPrice } from "@/lib/sushiswap";
import { getChainName } from "@/lib/chains";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-4-turbo"),
    messages: convertToModelMessages(messages),
    system: `You are a helpful multi-chain SushiSwap trading assistant. You help users get quotes and swap tokens across multiple blockchains.

      🔗 SushiSwap Supported Chains (VERIFIED):
      - Ethereum (chainId: 1) ✅
      - Arbitrum (chainId: 42161) ✅
      - Polygon (chainId: 137) ✅
      - BNB Chain (chainId: 56) ✅

      ⚠️ Currently NOT Supported by SushiSwap:
      - Unichain (chainId: 130) - Coming soon! Suggest users try Ethereum, Arbitrum, Polygon, or BNB Chain instead.

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
      When user asks: "What's the price of BNB?" or "How much is ETH?" or "BNB price"
      - This means USD price
      - Use getTokenUSDPrice tool
      - Only need: Token + Chain
      - DO NOT ask for quote token

      USE CASE 2: USER ASKS FOR CONVERSION RATE
      When user asks: "How much BNB in USDC?" or "Convert 1 ETH to USDC" or "1 BNB = ? USDC"
      - This means token-to-token conversion
      - Use getSwapQuote or getTokenPrice tool
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
      - If user says "polygon" or "MATIC" → chainId: 137
      - If user says "arbitrum" or "ARB" → chainId: 42161
      - If user says "bnb" or "bsc" or "binance" → chainId: 56
      - If user says "ethereum" or "mainnet" or "eth" → chainId: 1
      - If user says "unichain" → Politely explain it's not yet supported, suggest alternatives

      NEVER assume a default chain. ALWAYS ask if not specified.

      When you have all information and get a quote:
      - Show chain name clearly
      - Show input and output amounts
      - Show price impact and gas estimates
      - Ask for confirmation before executing any swap

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
          "Get a real-time quote for swapping tokens on SushiSwap. ONLY call this when you have confirmed: fromToken, toToken, amount, AND chainId with the user. Do NOT assume defaults.",
        inputSchema: z.object({
          fromToken: z
            .string()
            .describe(
              "The token symbol to swap from (e.g., WETH, USDC) - REQUIRED, must be confirmed by user"
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
              "Chain ID - REQUIRED, must be explicitly provided by user. 1=Ethereum, 42161=Arbitrum, 137=Polygon, 56=BNB. NO DEFAULT - always ask if not specified"
            )
        }),
        execute: async ({ fromToken, toToken, amount, chainId }) => {
          try {
            const normalizedFrom = normalizeTokenSymbol(fromToken, chainId);
            const normalizedTo = normalizeTokenSymbol(toToken, chainId);
            const chainName = getChainName(chainId);

            // Get real-time quote from SushiSwap API (wallet address not needed for quote endpoint)
            const quote = await getSushiSwapQuote(
              normalizedFrom,
              normalizedTo,
              amount,
              undefined, // Wallet address not needed for /quote endpoint
              chainId,
              0.005 // 0.5% slippage
            );

            if (!quote.success) {
              return {
                success: false,
                error: quote.error || "Failed to get quote from SushiSwap"
              };
            }

            return {
              success: true,
              chain: chainName,
              chainId,
              fromToken: normalizedFrom,
              toToken: normalizedTo,
              inputAmount: amount,
              estimatedOutput: quote.outputAmount,
              priceImpact: quote.priceImpact || "N/A",
              gasEstimate: quote.gasEstimate || "N/A",
              route: quote.route || `${normalizedFrom} → ${normalizedTo}`,
              routeProcessorAddress: quote.routeProcessorAddress,
              routeProcessorArgs: quote.routeProcessorArgs
            };
          } catch (error) {
            return {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown error occurred"
            };
          }
        }
      }),
      executeSwap: tool({
        description:
          "Execute a token swap on SushiSwap. This will prepare the swap transaction data that needs to be signed by the user.",
        inputSchema: z.object({
          fromToken: z.string().describe("The token symbol to swap from"),
          toToken: z.string().describe("The token symbol to swap to"),
          amount: z.string().describe("The amount of input token to swap"),
          chainId: z
            .number()
            .optional()
            .describe(
              "Chain ID: 1=Ethereum, 42161=Arbitrum, 137=Polygon, 56=BNB (default: 1)"
            ),
          slippage: z
            .string()
            .optional()
            .describe("Slippage tolerance in percentage (default: 0.5)")
        }),
        execute: async ({
          fromToken,
          toToken,
          amount,
          chainId = 1,
          slippage = "0.5"
        }) => {
          try {
            const normalizedFrom = normalizeTokenSymbol(fromToken, chainId);
            const normalizedTo = normalizeTokenSymbol(toToken, chainId);

            const fromTokenData = await getTokenBySymbol(
              normalizedFrom,
              chainId
            );
            const toTokenData = await getTokenBySymbol(normalizedTo, chainId);

            if (!fromTokenData || !toTokenData) {
              return {
                success: false,
                error: `Token not found: ${
                  !fromTokenData ? normalizedFrom : normalizedTo
                }`
              };
            }

            // Return transaction data that will be used by the frontend
            return {
              success: true,
              message:
                "Swap prepared. Please confirm the transaction in your wallet.",
              transactionData: {
                fromToken: normalizedFrom,
                toToken: normalizedTo,
                amount,
                slippage,
                chainId,
                fromAddress: fromTokenData.address,
                toAddress: toTokenData.address
              }
            };
          } catch (error) {
            return {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown error occurred"
            };
          }
        }
      }),
      getTokenInfo: tool({
        description:
          "Get information about a specific token including its address and decimals. Supports thousands of tokens across multiple chains.",
        inputSchema: z.object({
          symbol: z
            .string()
            .describe("The token symbol (e.g., WETH, USDC, APE, LINK)"),
          chainId: z
            .number()
            .optional()
            .describe(
              "Chain ID: 1=Ethereum, 42161=Arbitrum, 137=Polygon, 56=BNB (default: 1)"
            )
        }),
        execute: async ({ symbol, chainId = 1 }) => {
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
      getTokenPrice: tool({
        description:
          "Get the current price of a token in terms of another token using SushiSwap real-time data. ONLY call this when you have confirmed: fromToken, toToken (what to price it in), AND chainId with the user. Do NOT assume defaults.",
        inputSchema: z.object({
          fromToken: z
            .string()
            .describe(
              "The token to get the price for (e.g., WETH, WBTC, APE) - REQUIRED, must be confirmed by user"
            ),
          toToken: z
            .string()
            .describe(
              "The quote token to price it in (e.g., USDC, WETH, DAI) - REQUIRED, must be confirmed by user. Common choice is USDC but ALWAYS ask"
            ),
          chainId: z
            .number()
            .describe(
              "Chain ID - REQUIRED, must be explicitly provided by user. 1=Ethereum, 42161=Arbitrum, 137=Polygon, 56=BNB. NO DEFAULT - always ask if not specified"
            )
        }),
        execute: async ({ fromToken, toToken, chainId }) => {
          try {
            const normalizedFrom = normalizeTokenSymbol(fromToken, chainId);
            const normalizedTo = normalizeTokenSymbol(toToken, chainId);
            const chainName = getChainName(chainId);

            const price = await getSushiSwapPrice(
              normalizedFrom,
              normalizedTo,
              undefined,
              chainId
            );

            return {
              success: true,
              chain: chainName,
              chainId,
              token: normalizedFrom,
              quoteToken: normalizedTo,
              price,
              message: `1 ${normalizedFrom} = ${price} ${normalizedTo} on ${chainName}`
            };
          } catch (error) {
            return {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to get token price"
            };
          }
        }
      }),
      getTokenUSDPrice: tool({
        description:
          "Get the current USD price of a token using SushiSwap Price API. Use this when user asks for price without specifying the quote token (defaults to USD). ONLY call when you have confirmed the token symbol AND chainId. Do NOT assume defaults.",
        inputSchema: z.object({
          token: z
            .string()
            .describe(
              "The token to get USD price for (e.g., WETH, WBTC, APE) - REQUIRED"
            ),
          chainId: z
            .number()
            .describe(
              "Chain ID - REQUIRED, must be explicitly provided by user. 1=Ethereum, 42161=Arbitrum, 137=Polygon, 56=BNB. NO DEFAULT - always ask if not specified"
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
              userMessage: "Having trouble getting the price right now. Want to try again?",
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
