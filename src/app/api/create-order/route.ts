import { NextRequest, NextResponse } from 'next/server';
import { createCowSwapOrder, submitCowSwapOrder } from '@/lib/cowswap';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fromToken, toToken, amount, chainId, signature, orderData: signedOrderData } = body;

    if (!fromToken || !toToken || !amount || !chainId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const walletAddress = req.headers.get('x-wallet-address');
    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // If no signature provided, return order data for signing
    if (!signature) {
      const orderResult = await createCowSwapOrder(
        fromToken,
        toToken,
        amount,
        walletAddress,
        chainId
      );

      if (!orderResult.success) {
        return NextResponse.json(orderResult, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        needsSignature: true,
        orderData: orderResult.orderData,
        message: orderResult.message
      });
    }

    // If signature provided, use the SAME order data that was signed
    // CRITICAL: Do NOT re-fetch order data, as that would create a new quote
    // with different values, making the signature invalid
    if (!signedOrderData) {
      return NextResponse.json(
        { success: false, error: 'Order data required when submitting signature' },
        { status: 400 }
      );
    }

    // Submit the signed order
    // IMPORTANT: All addresses must be lowercase for CoW Protocol
    const signedOrder = {
      ...signedOrderData,
      signature,
      signingScheme: 'eip712' as const,
      from: walletAddress.toLowerCase(),
    };

    const submitResult = await submitCowSwapOrder(signedOrder, chainId);

    return NextResponse.json(submitResult);
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
