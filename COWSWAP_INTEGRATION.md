# CoW Protocol (CowSwap) Integration

This document explains the CoW Protocol integration for intent-based swaps in the Unipilot application.

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

## API Endpoints

### Base URLs

- **Arbitrum**: `https://api.cow.fi/arbitrum_one`
- **BNB Chain**: `https://api.cow.fi/bnb`
- **Staging**: `https://barn.api.cow.fi/{chain}`

### Key Endpoints

1. **POST /api/v1/quote** - Get a price quote for a swap
2. **POST /api/v1/orders** - Create a new order
3. **GET /api/v1/orders/{UID}** - Get order status
4. **DELETE /api/v1/orders/{UID}** - Cancel an order

## Implementation

### Files

- **`src/lib/cowswap.ts`** - Main CoW Protocol API client
- **`src/lib/cowswap-example.ts`** - Usage examples and test cases

### Core Functions

#### 1. `getCowTokenPrice(tokenSymbol, chainId)`

Get the USD price of a token using USDC as the quote token.

```typescript
const result = await getCowTokenPrice('ARB', 42161);
if (result.success) {
  console.log(`ARB price: $${result.price} USD`);
}
```

#### 2. `getCowSwapQuote(fromToken, toToken, amount, userAddress, chainId, slippage)`

Get a quote for swapping tokens.

```typescript
const quote = await getCowSwapQuote(
  'ARB',        // From token
  'USDC',       // To token
  '10',         // Amount
  userAddress,  // Optional for quotes
  42161,        // Arbitrum
  0.005         // 0.5% slippage
);

if (quote.success) {
  console.log(`Output: ~${quote.outputAmount} USDC`);
  console.log(`Fee: ${quote.feeAmount}`);
  console.log(`Price Impact: ${quote.priceImpact}`);
}
```

#### 3. `createCowSwapOrder(fromToken, toToken, amount, userAddress, chainId, slippage)`

Create an order (returns unsigned order data).

```typescript
const order = await createCowSwapOrder(
  'ARB',
  'USDC',
  '10',
  userAddress,
  42161,
  0.005
);

if (order.success) {
  // Order data ready to be signed by user's wallet
  console.log(order.orderData);
}
```

#### 4. `submitCowSwapOrder(signedOrderData, chainId)`

Submit a signed order to CoW Protocol.

```typescript
const result = await submitCowSwapOrder(signedOrder, 42161);
if (result.success) {
  console.log(`Order ID: ${result.orderId}`);
}
```

## Example: Swap 10 ARB to USDC on Arbitrum

### Step 1: Get Quote

```bash
curl -X POST 'https://api.cow.fi/arbitrum_one/api/v1/quote' \
  -H 'Content-Type: application/json' \
  -d '{
    "sellToken": "0x912CE59144191C1204E64559FE8253a0e49E6548",
    "buyToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    "from": "0x0000000000000000000000000000000000000000",
    "kind": "sell",
    "sellAmountBeforeFee": "10000000000000000000",
    "priceQuality": "verified",
    "signingScheme": "eip712",
    "onchainOrder": false,
    "validTo": 1760434480,
    "partiallyFillable": false
  }'
```

### Response

```json
{
  "quote": {
    "sellToken": "0x912ce59144191c1204e64559fe8253a0e49e6548",
    "buyToken": "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    "sellAmount": "9917593681267978752",
    "buyAmount": "3313871",
    "validTo": 1760434480,
    "feeAmount": "82406318732021248",
    "kind": "sell"
  },
  "id": 58112947
}
```

### Calculation

- **Sell Amount**: 9,917,593,681,267,978,752 wei = ~9.92 ARB (after fees)
- **Buy Amount**: 3,313,871 = 3.313871 USDC (6 decimals)
- **Fee**: 82,406,318,732,021,248 wei = ~0.08 ARB

**Result**: 10 ARB → ~3.31 USDC

### Step 2: Sign Order (Using wagmi)

```typescript
import { useSignTypedData } from 'wagmi';

// EIP-712 domain and types for CoW Protocol
const domain = {
  name: 'Gnosis Protocol',
  version: 'v2',
  chainId: 42161,
  verifyingContract: '0x...' // Settlement contract address
};

const types = {
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
};

const { signTypedData } = useSignTypedData();

const signature = await signTypedData({
  domain,
  types,
  value: orderData
});
```

### Step 3: Submit Order

```typescript
const signedOrder = {
  ...orderData,
  signature,
  signingScheme: 'eip712',
  from: userAddress
};

const result = await submitCowSwapOrder(signedOrder, 42161);
```

## Advantages of Intent-Based Swaps

### Traditional AMM Swaps (SushiSwap)
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

## Token Support

Currently hardcoded token list includes:

### Arbitrum (42161)
- **Stablecoins**: USDC, USDT, DAI
- **Major tokens**: WETH, WBTC, ARB, GMX, UNI

### BNB Chain (56)
- **Stablecoins**: USDC, USDT, DAI
- **Major tokens**: WBNB, WETH, BTCB, CAKE, ADA

## Error Handling

All functions return a consistent error format:

```typescript
{
  success: false,
  userMessage: "User-friendly error message",
  error: "Technical error details"
}
```

## Running Examples

To run the example code:

```bash
# Install dependencies
npm install

# Run the example (if configured as a script)
npm run cowswap-example
```

Or use in your code:

```typescript
import { runAllExamples } from './src/lib/cowswap-example';

runAllExamples();
```

## Integration with wagmi

The implementation is designed to work with wagmi for wallet interactions:

```typescript
import { useAccount, useSignTypedData, useWriteContract } from 'wagmi';
import { getCowSwapQuote, createCowSwapOrder, submitCowSwapOrder } from '@/lib/cowswap';

function SwapComponent() {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const handleSwap = async () => {
    // 1. Get quote
    const quote = await getCowSwapQuote('ARB', 'USDC', '10', address, 42161);

    // 2. Create order
    const order = await createCowSwapOrder('ARB', 'USDC', '10', address, 42161);

    // 3. Sign with wagmi
    const signature = await signTypedDataAsync({
      domain: { /* ... */ },
      types: { /* ... */ },
      value: order.orderData
    });

    // 4. Submit
    const result = await submitCowSwapOrder(
      { ...order.orderData, signature, signingScheme: 'eip712', from: address },
      42161
    );
  };
}
```

## API Documentation

- **CoW Protocol Docs**: https://docs.cow.fi/
- **OpenAPI Spec**: https://github.com/cowprotocol/services/blob/main/crates/orderbook/openapi.yml
- **Swagger UI**: https://api.cow.fi/docs/
- **Tutorial**: https://learn.cow.fi/tutorial/quote-order

## Future Enhancements

1. **Support more chains** (Ethereum, Polygon, Base, etc.)
2. **Implement full order signing** with wagmi/viem
3. **Add order status tracking**
4. **Implement order cancellation**
5. **Add TWAP (Time-Weighted Average Price) orders**
6. **Integrate with chat route** for AI assistant

## Notes

- CoW Protocol uses **EIP-712** for order signing
- Orders are valid for 30 minutes by default
- Fees are automatically calculated by the API
- Gas is often subsidized for certain swap pairs
- Orders execute when solvers find profitable opportunities in batch auctions
