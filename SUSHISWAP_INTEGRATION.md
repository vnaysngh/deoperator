# SushiSwap API Integration

This document describes the SushiSwap API integration for real-time token swap quotes and pricing.

## Overview

The application now uses the SushiSwap v7 API to fetch real-time quotes for token swaps. This provides accurate pricing, price impact calculations, and gas estimates directly from SushiSwap's routing engine.

## Files Added/Modified

### New Files

1. **`src/lib/sushiswap.ts`** - SushiSwap API integration module
   - `getSushiSwapQuote()` - Fetches real-time swap quotes
   - `getSushiSwapPrice()` - Gets current token price

### Modified Files

1. **`src/app/api/chat/route.ts`** - Updated AI chat route
   - Integrated SushiSwap API for real-time quotes
   - Updated system prompt to reflect SushiSwap integration
   - Added `getTokenPrice` tool for price checking
   - Enhanced `getSwapQuote` tool to use SushiSwap API

2. **`src/components/Chat.tsx`** - Enhanced UI components
   - Beautiful quote display with formatted data
   - Price impact and gas estimate visualization
   - Real-time quote fetching indicators
   - Dedicated price display component

3. **`.env.example`** - Updated environment variables
   - Added SushiSwap API key placeholder (optional)

## API Details

### SushiSwap API Endpoint

```
Base URL: https://api.sushi.com/quote/v7
Endpoint: /{chainId}?tokenIn={address}&tokenOut={address}&amount={wei}&fee={number}&feeBy={string}&maxSlippage={decimal}&vizualize={boolean}
```

### Parameters

- **chainId**: Blockchain network ID (1 for Ethereum mainnet)
- **tokenIn**: Input token contract address
- **tokenOut**: Output token contract address
- **amount**: Input amount in smallest unit (wei for ETH)
- **fee**: Fee amount (use 0 for no additional fee)
- **feeBy**: Fee calculation method ("output" or "input")
- **maxSlippage**: Maximum acceptable slippage (e.g., 0.005 = 0.5%)
- **vizualize**: Whether to return visualization data (use false)

## Features Implemented

### 1. Real-Time Quote Fetching

The `getSushiSwapQuote()` function fetches real-time quotes from SushiSwap with:
- Input/output token amounts
- Price impact estimation
- Gas cost estimates
- Optimal routing information
- Route processor contract details

### 2. Token Price Checking

The `getTokenPrice()` function provides current token prices:
- Defaults to USDC as quote currency
- Supports any token pair
- Returns formatted price information

### 3. Enhanced UI Display

Quote information is displayed in a beautiful, easy-to-read format:
- Emerald badge indicating SushiSwap quote
- Grid layout for key metrics
- Conditional display of price impact and gas estimates
- Route visualization

### 4. AI Chat Integration

The AI assistant now:
- Fetches real-time quotes automatically
- Presents detailed quote information
- Confirms trade details before execution
- Provides price checks on demand

## Usage Examples

### Get a Swap Quote

**User Input:**
```
"Get me a quote for swapping 1 WETH to USDC"
```

**Response:**
- Real-time quote from SushiSwap
- Expected output amount
- Price impact percentage
- Estimated gas cost
- Routing information

### Check Token Price

**User Input:**
```
"What's the price of WBTC?"
```

**Response:**
- Current WBTC price in USDC
- Fetched from SushiSwap liquidity pools

### Compare Rates

**User Input:**
```
"Show me the best rate for 0.5 ETH to USDT"
```

**Response:**
- Real-time quote with optimal routing
- Detailed breakdown of the swap

## Supported Tokens

- WETH (Wrapped Ether)
- USDC (USD Coin)
- USDT (Tether USD)
- DAI (Dai Stablecoin)
- WBTC (Wrapped BTC)
- UNI (Uniswap)

## Configuration

### Environment Variables

Add to your `.env.local` file:

```bash
# Optional: SushiSwap API Key for production use
NEXT_PUBLIC_SUSHISWAP_API_KEY=your_api_key_here
```

**Note:** Currently, the API works without an API key, but you may need one for production usage with higher rate limits. Get your API key from [https://sushi.com/portal](https://sushi.com/portal).

## API Response Format

### Successful Quote Response

```typescript
{
  success: true,
  fromToken: "WETH",
  toToken: "USDC",
  inputAmount: "1",
  outputAmount: "3500.123456",
  priceImpact: "0.05%",
  gasEstimate: "150000",
  route: "WETH → USDC",
  routeProcessorAddress: "0x...",
  routeProcessorArgs: { ... }
}
```

### Error Response

```typescript
{
  success: false,
  fromToken: "WETH",
  toToken: "USDC",
  inputAmount: "1",
  outputAmount: "0",
  error: "Error message here"
}
```

## Error Handling

The integration includes comprehensive error handling:
- Token not found errors
- Network/API errors
- Invalid amount errors
- No route available errors

All errors are gracefully handled and displayed to the user with helpful messages.

## Testing

The application has been built successfully with:
- TypeScript type checking ✓
- ESLint validation ✓
- Next.js build optimization ✓

## Next Steps

To start using the integration:

1. Ensure you have a valid OpenAI API key in `.env.local`
2. Configure RPC URL for blockchain access
3. Set up WalletConnect Project ID
4. Run the development server: `npm run dev`
5. Connect your wallet
6. Start requesting quotes!

## Technical Notes

- The API automatically handles token decimal conversions
- Slippage is set to 0.5% by default
- Quotes are fetched in real-time on each request
- The UI displays all available quote information
- Route processor details are included for swap execution

## Troubleshooting

### 422 Error or API Errors
**Solution**: Make sure you're using the correct endpoint (`/quote/v7/` not `/swap/v7/`) and all required parameters are included.

### API Not Responding
- Check internet connection
- Verify the API endpoint is accessible
- Check browser console for CORS issues

### Incorrect Quote Amounts
- Verify token addresses are correct
- Check decimal handling in conversion
- Ensure amount is in proper format

### No Route Found
- Try different token pairs
- Check if tokens have sufficient liquidity
- Verify chain ID is correct (1 for mainnet)

### Getting Quotes Without Wallet
The `/quote/v7/` endpoint does NOT require a connected wallet. You can get quotes anytime!
However, to execute swaps, you will need to connect your wallet.

## Resources

- [SushiSwap API Documentation](https://docs.sushi.com/api/swagger)
- [SushiSwap Portal](https://sushi.com/portal)
- [SushiSwap Swap Interface](https://www.sushi.com/swap)
