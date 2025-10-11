import { NextRequest, NextResponse } from 'next/server'
import { getSwapQuote } from '@/lib/uniswap'

export async function POST(req: NextRequest) {
  try {
    const { fromToken, toToken, amount, slippage = '0.5' } = await req.json()

    if (!fromToken || !toToken || !amount) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Get quote from Uniswap
    const quote = await getSwapQuote(fromToken, toToken, amount)

    return NextResponse.json({
      success: true,
      quote,
      slippage,
    })
  } catch (error) {
    console.error('Swap preparation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
