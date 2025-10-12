import { openai } from "@ai-sdk/openai";
import { streamText, tool, convertToModelMessages, UIMessage } from "ai";
import { z } from "zod";
import { getTokenBySymbol, normalizeTokenSymbol } from "@/lib/tokens";
import { getSushiSwapQuote, getSushiSwapPrice } from "@/lib/sushiswap";
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
      - Popular tokens: WETH, USDC, USDT, DAI, WBTC, UNI, LINK, AAVE, APE (ApeCoin), PEPE, SHIB, etc.
      - Chain-specific tokens: ARB (Arbitrum), MATIC (Polygon), WBNB/BTCB (BNB Chain)

      🚨 CRITICAL RULE - ALWAYS ASK FOR CLARIFICATION:
      You MUST have ALL THREE pieces of information before calling any tool:
      1. From Token (e.g., APE, WETH, USDC)
      2. To Token (e.g., USDC, WETH, DAI)
      3. Chain ID (which blockchain)

      If the user does NOT explicitly provide ALL THREE, you MUST ask clarifying questions:

      BAD Examples (DO NOT DO THIS):
      ❌ User: "What's the price of APE?"
        Bad Response: *calls getTokenPrice with APE/USDC on Ethereum*

      ❌ User: "Quote for APE to USDC"
        Bad Response: *calls getSwapQuote assuming Ethereum*

      GOOD Examples (DO THIS):
      ✅ User: "What's the price of APE?"
        Good Response: "I'd be happy to check the APE price! Just to confirm:
        - Did you mean ApeCoin (APE)?
        - Which token would you like to see the price in? (e.g., USDC, WETH)
        - Which chain? (Ethereum, Arbitrum, Polygon, BNB Chain)"

      ✅ User: "Quote for APE to USDC"
        Good Response: "Sure! Just to confirm - which chain would you like this quote on?
        - Ethereum (mainnet)
        - Arbitrum
        - Polygon
        - BNB Chain"

      ✅ User: "What's the price of APE in USDC on Ethereum?"
        Good Response: *calls getTokenPrice with all parameters provided*

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
      })
    }
  });

  return result.toUIMessageStreamResponse();
}
