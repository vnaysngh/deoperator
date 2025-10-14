/**
 * Client-side CoW Protocol Trading SDK
 *
 * This is the ONLY file that uses the Trading SDK.
 * All quote fetching, order signing, and submission happens CLIENT-SIDE.
 *
 * Documentation: https://github.com/cowprotocol/cow-sdk/blob/main/packages/trading/README.md
 */

import { TradingSdk } from '@cowprotocol/sdk-trading';
import { OrderKind } from '@cowprotocol/sdk-order-book';
import { SupportedChainId } from '@cowprotocol/sdk-config';
import { ViemAdapter } from '@cowprotocol/sdk-viem-adapter';
import type { PublicClient, WalletClient, Address } from 'viem';

/**
 * Map chain IDs to CoW Protocol supported chains
 */
function getCowChainId(chainId: number): SupportedChainId {
  switch (chainId) {
    case 1:
      return SupportedChainId.MAINNET;
    case 100:
      return SupportedChainId.GNOSIS_CHAIN;
    case 42161:
      return SupportedChainId.ARBITRUM_ONE;
    case 8453:
      return SupportedChainId.BASE;
    case 11155111:
      return SupportedChainId.SEPOLIA;
    default:
      throw new Error(`Chain ${chainId} is not supported by CoW Protocol`);
  }
}

/**
 * Create Trading SDK instance
 * This should ONLY be called on the client side with a connected wallet
 */
function createTradingSdk(
  publicClient: PublicClient,
  walletClient: WalletClient,
  chainId: number
): TradingSdk {
  const adapter = new ViemAdapter({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider: publicClient as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    walletClient: walletClient as any,
  });

  const cowChainId = getCowChainId(chainId);

  return new TradingSdk(
    {
      chainId: cowChainId,
      appCode: 'Unipilot',
    },
    {},
    adapter
  );
}

/**
 * Get a quote for a swap using the Trading SDK
 * This calls sdk.getQuote() on the client side
 */
export async function getSwapQuote(
  publicClient: PublicClient,
  walletClient: WalletClient,
  params: {
    sellToken: Address;
    sellTokenDecimals: number;
    buyToken: Address;
    buyTokenDecimals: number;
    amount: string; // In smallest unit (e.g., wei)
    userAddress: Address;
    chainId: number;
  }
) {
  console.log('[CLIENT SDK] Creating Trading SDK instance...');
  const sdk = createTradingSdk(publicClient, walletClient, params.chainId);

  console.log('[CLIENT SDK] Requesting quote from Trading SDK...');
  const quoteParams = {
    kind: OrderKind.SELL,
    sellToken: params.sellToken,
    sellTokenDecimals: params.sellTokenDecimals,
    buyToken: params.buyToken,
    buyTokenDecimals: params.buyTokenDecimals,
    amount: params.amount,
    userAddress: params.userAddress,
    validFor: 600, // 10 minutes
  };

  // Get quote from Trading SDK
  // Returns: { quoteResults, postSwapOrderFromQuote }
  const quoteResponse = await sdk.getQuote(quoteParams);
  console.log('[CLIENT SDK] Quote received from Trading SDK');

  return quoteResponse;
}

/**
 * Complete flow: Get quote and submit order
 *
 * This follows the recommended Trading SDK flow:
 * 1. sdk.getQuote() - Get quote and submission function
 * 2. User confirms the quote
 * 3. postSwapOrderFromQuote() - Submit the order (signing happens automatically)
 */
export async function quoteAndSubmitSwap(
  publicClient: PublicClient,
  walletClient: WalletClient,
  params: {
    sellToken: Address;
    sellTokenDecimals: number;
    buyToken: Address;
    buyTokenDecimals: number;
    amount: string; // In smallest unit
    userAddress: Address;
    chainId: number;
  }
): Promise<{
  orderId: string;
  quote: {
    buyAmount: bigint;
    sellAmount: bigint;
    feeAmount: bigint;
  };
}> {
  console.log('[CLIENT SDK] Starting quote and submit flow...');

  // Step 1: Get quote from Trading SDK
  const { quoteResults, postSwapOrderFromQuote } = await getSwapQuote(
    publicClient,
    walletClient,
    params
  );

  if (!quoteResults || !quoteResults.amountsAndCosts) {
    throw new Error('Failed to get quote from Trading SDK');
  }

  // Step 2: Extract quote details
  const { amountsAndCosts } = quoteResults;
  const quote = {
    buyAmount: BigInt(amountsAndCosts.afterSlippage.buyAmount),
    sellAmount: BigInt(amountsAndCosts.beforeNetworkCosts.sellAmount),
    feeAmount: BigInt(amountsAndCosts.costs.networkFee.amountInSellCurrency),
  };

  console.log('[CLIENT SDK] Quote:', {
    buyAmount: quote.buyAmount,
    sellAmount: quote.sellAmount,
    feeAmount: quote.feeAmount,
  });

  // Step 3: Submit order using the postSwapOrderFromQuote function
  // This function is returned by sdk.getQuote() and handles signing automatically
  console.log('[CLIENT SDK] Submitting order via Trading SDK...');
  const orderResult = await postSwapOrderFromQuote();

  console.log('[CLIENT SDK] Order submitted successfully!');
  console.log('[CLIENT SDK] Order ID:', orderResult.orderId);
  console.log('[CLIENT SDK] Explorer:', `https://explorer.cow.fi/orders/${orderResult.orderId}?chainId=${params.chainId}`);

  return {
    orderId: orderResult.orderId,
    quote,
  };
}

/**
 * Export types for convenience
 */
export type { PublicClient, WalletClient, Address };
export { OrderKind, SupportedChainId };
