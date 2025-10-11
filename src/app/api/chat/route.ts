import { openai } from '@ai-sdk/openai'
import { streamText, tool } from 'ai'
import { z } from 'zod'
import { getTokenBySymbol, normalizeTokenSymbol } from '@/lib/tokens'

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: openai('gpt-4-turbo'),
    messages,
    system: `You are a helpful Uniswap trading assistant. You can help users:
- Get quotes for token swaps
- Execute token swaps on Uniswap
- Check token prices
- Provide information about available tokens

Available tokens: WETH, USDC, USDT, DAI, WBTC, UNI

When users ask to swap tokens:
1. Extract the token symbols and amounts from their request
2. Use the getSwapQuote tool to get a quote
3. If they confirm, use the executeSwap tool

Be conversational and confirm details before executing trades.`,
    tools: {
      getSwapQuote: tool({
        description: 'Get a quote for swapping tokens on Uniswap. Returns the expected output amount.',
        inputSchema: z.object({
          fromToken: z.string().describe('The token symbol to swap from (e.g., WETH, USDC)'),
          toToken: z.string().describe('The token symbol to swap to (e.g., USDC, DAI)'),
          amount: z.string().describe('The amount of input token to swap'),
        }),
        execute: async ({ fromToken, toToken, amount }) => {
          try {
            const normalizedFrom = normalizeTokenSymbol(fromToken)
            const normalizedTo = normalizeTokenSymbol(toToken)

            const fromTokenData = getTokenBySymbol(normalizedFrom)
            const toTokenData = getTokenBySymbol(normalizedTo)

            if (!fromTokenData || !toTokenData) {
              return {
                success: false,
                error: `Token not found. Available tokens: WETH, USDC, USDT, DAI, WBTC, UNI`,
              }
            }

            // In a real implementation, this would call the Uniswap Smart Order Router
            // For now, we'll return a mock quote
            const mockRate = normalizedFrom === 'WETH' && normalizedTo === 'USDC' ? 3500 : 0.0003
            const estimatedOutput = (parseFloat(amount) * mockRate).toFixed(6)

            return {
              success: true,
              fromToken: normalizedFrom,
              toToken: normalizedTo,
              inputAmount: amount,
              estimatedOutput,
              priceImpact: '0.1%',
              route: `${normalizedFrom} → ${normalizedTo}`,
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error occurred',
            }
          }
        },
      }),
      executeSwap: tool({
        description: 'Execute a token swap on Uniswap. This will prepare the swap transaction data that needs to be signed by the user.',
        inputSchema: z.object({
          fromToken: z.string().describe('The token symbol to swap from'),
          toToken: z.string().describe('The token symbol to swap to'),
          amount: z.string().describe('The amount of input token to swap'),
          slippage: z.string().optional().describe('Slippage tolerance in percentage (default: 0.5)'),
        }),
        execute: async ({ fromToken, toToken, amount, slippage = '0.5' }) => {
          try {
            const normalizedFrom = normalizeTokenSymbol(fromToken)
            const normalizedTo = normalizeTokenSymbol(toToken)

            const fromTokenData = getTokenBySymbol(normalizedFrom)
            const toTokenData = getTokenBySymbol(normalizedTo)

            if (!fromTokenData || !toTokenData) {
              return {
                success: false,
                error: 'Token not found',
              }
            }

            // Return transaction data that will be used by the frontend
            return {
              success: true,
              message: 'Swap prepared. Please confirm the transaction in your wallet.',
              transactionData: {
                fromToken: normalizedFrom,
                toToken: normalizedTo,
                amount,
                slippage,
                fromAddress: fromTokenData.address,
                toAddress: toTokenData.address,
              },
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error occurred',
            }
          }
        },
      }),
      getTokenInfo: tool({
        description: 'Get information about a specific token including its address and decimals.',
        inputSchema: z.object({
          symbol: z.string().describe('The token symbol (e.g., WETH, USDC)'),
        }),
        execute: async ({ symbol }) => {
          const normalized = normalizeTokenSymbol(symbol)
          const token = getTokenBySymbol(normalized)

          if (!token) {
            return {
              success: false,
              error: `Token ${symbol} not found. Available tokens: WETH, USDC, USDT, DAI, WBTC, UNI`,
            }
          }

          return {
            success: true,
            symbol: token.symbol,
            name: token.name,
            address: token.address,
            decimals: token.decimals,
            chainId: token.chainId,
          }
        },
      }),
    },
  })

  return result.toTextStreamResponse()
}
