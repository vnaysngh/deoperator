# CoW Protocol (CowSwap) Integration

This document explains the CoW Protocol integration using the **official CoW SDK** for intent-based swaps in the Unipilot application.

## Overview

CoW Protocol is a fully permissionless trading protocol that uses **intent-based swaps** through batch auctions. Unlike traditional AMM swaps, CoW Protocol:

- Uses **batch auctions** to find the best execution price
- Often provides **MEV protection** by batching orders together
- Can offer **gas subsidies** for certain swaps
- Finds liquidity across multiple sources (AMMs, aggregators, private solvers)

## Supported Chains

The implementation currently supports:

- **Arbitrum** (chainId: 42161)
- **BNB Chain** (chainId: 56)
- **Ethereum** (chainId: 1)
- **Gnosis Chain** (chainId: 100)
- **Base** (chainId: 8453)
- **Sepolia** (chainId: 11155111) - Testnet

## SDK Implementation

This project uses the **official CoW Protocol Trading SDK** (`@cowprotocol/cow-sdk`) for all interactions with CoW Protocol. This is the recommended approach as it:

- Provides type-safe interfaces
- Handles API versioning automatically
- Includes built-in error handling
- Supports EIP-712 signing out of the box
- Is maintained by the CoW Protocol team

### Installation

```bash
npm install @cowprotocol/cow-sdk
```

### Files

- **`src/lib/cowswap-sdk.ts`** - Main CoW Protocol SDK integration
- **`src/app/api/create-order/route.ts`** - API route for order creation
- **`src/app/api/chat/route.ts`** - AI chat integration with CoW Protocol

## Core Functions

### 1. `getCowSwapQuoteSDK(fromToken, toToken, amount, userAddress, chainId, slippage)`

Get a real-time quote for swapping tokens using the CoW SDK.

```typescript
import { getCowSwapQuoteSDK } from '@/lib/cowswap-sdk';

const quote = await getCowSwapQuoteSDK(
  'ARB',        // From token symbol
  'USDC',       // To token symbol
  '10',         // Amount to swap
  userAddress,  // Optional - can be undefined for quotes
  42161,        // Arbitrum chain ID
  0.005         // 0.5% slippage (optional, defaults to 0.005)
);

if (quote.success) {
  console.log(`Output: ~${quote.outputAmount} USDC`);
  console.log(`Fee: ${quote.feeAmount}`);
  console.log(`Price Impact: ${quote.priceImpact}`);
  console.log(`Route: ${quote.route}`);
}
```

**Response:**
```typescript
{
  success: true,
  outputAmount: "3.313871",
  priceImpact: "< 0.01",
  gasEstimate: "~Free (subsidized by protocol)",
  route: "ARB → [CoW Protocol Batch Auction] → USDC",
  feeAmount: "0.082406 ARB"
}
```

### 2. `getCowTokenPriceSDK(tokenSymbol, chainId)`

Get the USD price of a token using the SDK.

```typescript
import { getCowTokenPriceSDK } from '@/lib/cowswap-sdk';

const result = await getCowTokenPriceSDK('ARB', 42161);

if (result.success) {
  console.log(`ARB price: $${result.price} USD`);
}
```

### 3. `prepareSwapOrder(params)`

Prepare an order for signing using the SDK. This returns unsigned order data that needs to be signed by the user's wallet.

```typescript
import { prepareSwapOrder } from '@/lib/cowswap-sdk';

const orderResult = await prepareSwapOrder({
  fromTokenSymbol: 'ARB',
  toTokenSymbol: 'USDC',
  amount: '10',
  userAddress: '0x1234...',
  chainId: 42161,
  slippage: 0.005 // Optional, defaults to 0.005
});

if (orderResult.success) {
  // Order data ready to be signed by user's wallet
  console.log('Order data:', orderResult.orderData);
  console.log('Message:', orderResult.message);
}
```

**Response:**
```typescript
{
  success: true,
  orderData: {
    sellToken: "0x912ce59144191c1204e64559fe8253a0e49e6548",
    buyToken: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    sellAmount: "9917593681267978752",
    buyAmount: "3313871",
    validTo: 1760434480,
    appData: "0x...",
    feeAmount: "82406318732021248",
    kind: OrderKind.SELL,
    partiallyFillable: false,
    receiver: "0x1234...",
    sellTokenBalance: "erc20",
    buyTokenBalance: "erc20"
  },
  message: "Order ready for signing..."
}
```

### 4. `submitSwapOrder(orderData, signature, chainId, signingScheme)`

Submit a signed order to CoW Protocol using the SDK.

```typescript
import { submitSwapOrder, SigningScheme } from '@/lib/cowswap-sdk';

const result = await submitSwapOrder(
  orderData,           // Order data from prepareSwapOrder
  signature,           // EIP-712 signature from user's wallet
  42161,              // Chain ID
  SigningScheme.EIP712 // Signing scheme
);

if (result.success) {
  console.log(`Order ID: ${result.orderId}`);
  console.log(`Message: ${result.message}`);
  console.log(`Explorer: https://explorer.cow.fi/orders/${result.orderId}?chain=42161`);
}
```

## Complete Swap Flow Example

Here's a complete example of how to swap tokens using the SDK:

```typescript
import {
  getCowSwapQuoteSDK,
  prepareSwapOrder,
  submitSwapOrder
} from '@/lib/cowswap-sdk';
import { SigningScheme } from '@cowprotocol/cow-sdk';
import { useSignTypedData } from 'wagmi';

async function swapTokens(
  fromToken: string,
  toToken: string,
  amount: string,
  userAddress: string,
  chainId: number
) {
  // Step 1: Get a quote
  const quote = await getCowSwapQuoteSDK(
    fromToken,
    toToken,
    amount,
    userAddress,
    chainId
  );

  if (!quote.success) {
    console.error('Quote failed:', quote.userMessage);
    return;
  }

  console.log(`You will receive approximately ${quote.outputAmount} ${toToken}`);
  console.log(`Fee: ${quote.feeAmount}`);

  // Step 2: Prepare the order
  const orderResult = await prepareSwapOrder({
    fromTokenSymbol: fromToken,
    toTokenSymbol: toToken,
    amount,
    userAddress,
    chainId
  });

  if (!orderResult.success) {
    console.error('Order preparation failed:', orderResult.userMessage);
    return;
  }

  // Step 3: Sign the order using wagmi (this happens in the frontend)
  const { signTypedDataAsync } = useSignTypedData();

  const signature = await signTypedDataAsync({
    domain: {
      name: 'Gnosis Protocol',
      version: 'v2',
      chainId: chainId,
      verifyingContract: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41' // Settlement contract
    },
    types: {
      Order: [
        { name: 'sellToken', type: 'address' },
        { name: 'buyToken', type: 'address' },
        { name: 'receiver', type: 'address' },
        { name: 'sellAmount', type: 'uint256' },
        { name: 'buyAmount', type: 'uint256' },
        { name: 'validTo', type: 'uint32' },
        { name: 'appData', type: 'bytes32' },
        { name: 'feeAmount', type: 'uint256' },
        { name: 'kind', type: 'string' },
        { name: 'partiallyFillable', type: 'bool' },
        { name: 'sellTokenBalance', type: 'string' },
        { name: 'buyTokenBalance', type: 'string' }
      ]
    },
    primaryType: 'Order',
    message: orderResult.orderData
  });

  // Step 4: Submit the signed order
  const submitResult = await submitSwapOrder(
    orderResult.orderData,
    signature,
    chainId,
    SigningScheme.EIP712
  );

  if (submitResult.success) {
    console.log(`Order submitted! ID: ${submitResult.orderId}`);
    console.log(`View on explorer: https://explorer.cow.fi/orders/${submitResult.orderId}`);
  } else {
    console.error('Order submission failed:', submitResult.error);
  }
}

// Usage
swapTokens('ARB', 'USDC', '10', '0x1234...', 42161);
```

## Integration with API Routes

The SDK is integrated into Next.js API routes for server-side order management:

### `/api/create-order`

This endpoint handles both order preparation and submission:

**Request to prepare order:**
```typescript
POST /api/create-order
Headers: { 'x-wallet-address': '0x1234...' }
Body: {
  fromToken: 'ARB',
  toToken: 'USDC',
  amount: '10',
  chainId: 42161,
  slippage: 0.005
}
```

**Response:**
```typescript
{
  success: true,
  needsSignature: true,
  orderData: { /* order data to sign */ },
  message: "Order ready for signing..."
}
```

**Request to submit signed order:**
```typescript
POST /api/create-order
Headers: { 'x-wallet-address': '0x1234...' }
Body: {
  fromToken: 'ARB',
  toToken: 'USDC',
  amount: '10',
  chainId: 42161,
  orderData: { /* signed order data */ },
  signature: '0xabcd...'
}
```

**Response:**
```typescript
{
  success: true,
  orderId: '0x...',
  message: "Order submitted successfully!"
}
```

## Advantages of Intent-Based Swaps

### Traditional AMM Swaps
- Execute immediately at current pool price
- Subject to MEV (frontrunning, sandwich attacks)
- Gas costs paid by user
- Price depends on pool liquidity

### Intent-Based Swaps (CoW Protocol)
- Execute in batch auctions (find best price)
- MEV protection through batch mechanism
- Often subsidized gas costs
- Finds best price across multiple sources
- Solvers compete to fill your order
- Better execution for large trades

## Token Support

The application supports thousands of tokens via curated lists and CoinGecko enrichment:

### Arbitrum (42161)
- **Stablecoins**: USDC, USDT, DAI
- **Major tokens**: WETH, WBTC, ARB, GMX, UNI, LINK, AAVE

### BNB Chain (56)
- **Stablecoins**: USDC, USDT, BUSD, DAI
- **Major tokens**: WBNB, WETH, BTCB, CAKE, ADA

## Error Handling

All SDK functions return a consistent error format with user-friendly messages:

```typescript
{
  success: false,
  userMessage: "I couldn't find ARB on this chain. Could you double-check the token name?",
  error: "Token not found: ARB"
}
```

The `userMessage` field contains a friendly error message suitable for displaying to users, while the `error` field contains technical details for debugging.

## SDK vs Direct API Calls

**✅ Use the SDK (Recommended):**
- Type-safe interfaces
- Automatic API versioning
- Built-in error handling
- EIP-712 signing support
- Maintained by CoW Protocol team

**❌ Avoid Direct API Calls:**
- Manual type definitions required
- Need to handle API changes manually
- More boilerplate code
- Easy to make mistakes with signing

## Resources

- **CoW Protocol Docs**: https://docs.cow.fi/
- **CoW SDK GitHub**: https://github.com/cowprotocol/cow-sdk
- **Trading SDK Docs**: https://docs.cow.fi/cow-protocol/reference/sdks/cow-sdk
- **Tutorial**: https://learn.cow.fi/tutorial/submit-order
- **Order Explorer**: https://explorer.cow.fi/
- **OpenAPI Spec**: https://github.com/cowprotocol/services/blob/main/crates/orderbook/openapi.yml

## Implementation Notes

- **EIP-712 Signing**: CoW Protocol uses EIP-712 for secure order signing
- **Order Validity**: Orders are valid for 10 minutes for market orders (configurable)
- **Fee Calculation**: Fees are automatically calculated by the SDK
- **Gas Subsidies**: Gas is often subsidized for certain swap pairs
- **Batch Execution**: Orders execute when solvers find profitable opportunities in batch auctions
- **Slippage Protection**: Applied by reducing the minimum buy amount
- **Settlement Contract**: All orders settle through the CoW Protocol settlement contract
