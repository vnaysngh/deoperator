# DexLuthor.ai

A modern, AI-powered multi-chain trading interface using natural language. Built with Next.js 15, Vercel AI SDK, and CoW Protocol for intent-based trading.

## Features

- **Natural Language Trading**: Simply describe what you want to trade in plain English
- **AI-Powered Assistant**: GPT-4 powered chatbot understands trade requests and provides quotes
- **Multi-Chain Support**: Trade on Arbitrum and BNB Chain with 1,200+ verified tokens
- **Intent-Based Trading**: Powered by CoW Protocol for MEV protection and optimal execution
- **Real-time Quotes**: Get instant price quotes with fee estimates and price impact
- **Wallet Integration**: Secure wallet connection using RainbowKit and WalletConnect
- **Portfolio Balances**: View all your token balances and USD values across supported chains
- **Token Price Lookups**: Check real-time USD prices for any supported token

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Bundler**: Turbopack for fast development and production builds
- **AI**: Vercel AI SDK with OpenAI GPT-4 Turbo
- **Web3**: Wagmi 2.x, Viem 2.x, RainbowKit
- **DeFi**: CoW Protocol SDK (Trading, Order Book, Viem Adapter), Moralis API for token pricing, Uniswap SDK Core (for token types)
- **State Management**: TanStack React Query

## Prerequisites

- Node.js 18+ and npm (or yarn)
- A Web3 wallet (MetaMask, WalletConnect-compatible wallets, Coinbase Wallet, etc.)
- OpenAI API key (get from https://platform.openai.com/api-keys)
- WalletConnect Project ID (get from https://cloud.walletconnect.com/)
- Optional: Moralis API key (for token USD pricing - get from https://moralis.io/)
- Optional: Custom RPC endpoints for Arbitrum and BNB Chain (default public RPCs are provided)

## Getting Started

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd dexluthor
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory with your credentials:

```env
# Required: OpenAI API Key (get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-...

# Required: WalletConnect Project ID (get from https://cloud.walletconnect.com/)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Optional: Custom RPC URLs (defaults to public RPCs if not provided)
NEXT_PUBLIC_ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
NEXT_PUBLIC_BSC_RPC_URL=https://bsc-dataseed1.binance.org

# Optional: Moralis API Key for token USD pricing (get from https://moralis.io/)
MORALIS_API_KEY=your_moralis_api_key_here
```

**Note**: The application defaults to public RPC endpoints for Arbitrum and BNB Chain. You can provide custom RPC URLs for better performance and rate limits.

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Connect Your Wallet**: Click "Connect Wallet" and select your preferred wallet (supports Arbitrum and BNB Chain)
2. **Start Chatting**: Type natural language commands like:
   - "Swap 10 ARB for USDC on Arbitrum"
   - "Get me a quote for 100 USDC to USDT on BNB Chain"
   - "What's the price of WETH?"
   - "Show my wallet balances"
   - "Trade 0.5 WETH for DAI"
   - "Swap all my USDC to WETH"
3. **Review Quote**: The AI fetches a real-time quote from CoW Protocol with fee estimates and price impact
4. **Confirm Trade**: The AI prepares the swap order - you'll sign and submit it via your wallet
5. **Track Order**: Monitor your order status on CoW Protocol's intent-based batch auction system

## Project Structure

```
dexluthor.ai/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/
│   │   │       └── route.ts        # AI chat API with tool calling
│   │   ├── layout.tsx              # Root layout with providers
│   │   ├── page.tsx                # Main chat interface
│   │   └── global.css              # Global Tailwind styles (imported in layout)
│   ├── components/
│   │   ├── Chat.tsx                # Chat UI component with CoW integration
│   │   ├── WalletConnect.tsx       # Wallet connection button
│   │   ├── Providers.tsx           # Wagmi, RainbowKit & React Query providers
│   │   └── ErrorBoundary.tsx       # Error boundary for React errors
│   ├── lib/
│   │   ├── wagmi.ts                # Wagmi configuration (Arbitrum, BNB Chain)
│   │   ├── chains.ts               # Chain IDs and utilities
│   │   ├── tokens.ts               # Token list fetching and caching
│   │   ├── tokenlist.ts            # Token list interfaces
│   │   ├── cowswap-client.ts       # CoW Protocol Trading SDK integration
│   │   ├── token-pricing.ts        # Moralis API for token USD pricing
│   │   └── wallet-balances.ts      # Token balance fetching utilities
│   └── __tests__/                  # Test files
├── scripts/
│   └── check-tool-messages.sh      # Tool convention validation script
├── .env.local                      # Environment variables (create this)
├── test-cowswap-sdk.js             # CoW Protocol SDK test script
└── package.json
```

## Key Components

### AI Chat API (`src/app/api/chat/route.ts`)

The core API route handling natural language processing with GPT-4 Turbo and tool calling:

**AI Tools Available:**
- `getSwapQuote`: Fetches real-time quotes from CoW Protocol with fee estimates
- `createSwapOrder`: Prepares CoW Protocol swap order (intent-based trading)
- `getTokenPrice`: Returns USD price for any token via SushiSwap API
- `getWalletBalances`: Fetches all token balances with USD values for connected wallet
- `getTokenInfo`: Returns token details from Uniswap token lists

**Features:**
- Wallet address detection from request headers
- Multi-chain support (Arbitrum, BNB Chain)
- 1,200+ verified tokens from Uniswap and PancakeSwap token lists
- Contract address support for any token
- Comprehensive logging for debugging

### CoW Protocol Integration (`src/lib/cowswap-client.ts`)

Client-side CoW Protocol Trading SDK implementation:

- `quoteAndSubmitSwap()`: Get quote, sign order, and submit to CoW Protocol
- `getCowProtocolAllowance()`: Check token approval for CoW Protocol
- `approveCowProtocol()`: Approve tokens for trading
- **Intent-based trading**: Orders are submitted to batch auctions for optimal execution
- **MEV protection**: Batch auction system protects against MEV
- **Gas subsidies**: Many swaps have subsidized or free gas

### Token Management (`src/lib/tokens.ts`, `src/lib/tokenlist.ts`)

- Fetches token lists from Uniswap and PancakeSwap
- In-memory caching (1 hour TTL) for performance
- Support for native tokens, bridged tokens, and contract addresses
- 1,200+ verified tokens across Arbitrum and BNB Chain

### Wallet Balances (`src/lib/wallet-balances.ts`)

- `getTokenBalance()`: Fetch balance for specific token
- `getMultipleTokenBalances()`: Batch fetch balances with USD values
- Supports native tokens and ERC20 tokens
- Integration with SushiSwap API for USD pricing

### Chat UI (`src/components/Chat.tsx`)

- Built with Vercel AI SDK's `useChat` hook
- Real-time message streaming
- Tool invocation display with formatted output
- Client-side CoW Protocol order signing and submission
- Token approval flow handling
- Universal fallback handler for tool messages (ensures users always see feedback)

## Supported Networks

- **Arbitrum One** (Chain ID: 42161) ✅
- **BNB Chain** (Chain ID: 56) ✅

**Coming Soon:**
- Ethereum Mainnet (Chain ID: 1)
- Polygon (Chain ID: 137)
- Base (Chain ID: 8453)

## Supported Tokens

The application supports **1,200+ verified tokens** from:
- Uniswap token list (https://tokens.uniswap.org)
- PancakeSwap token list (for BNB Chain specific tokens)

**Popular tokens include:**

**Arbitrum:**
- WETH, USDC, USDT, DAI, WBTC, UNI, LINK, AAVE
- ARB (native Arbitrum token)
- Bridged tokens: SOL, AVAX, MATIC, etc.

**BNB Chain:**
- WBNB, USDC, USDT, DAI, BTCB (Bitcoin BEP20)
- CAKE (PancakeSwap)
- Bridged tokens and BEP20 tokens

**Token Lookup:**
- Use token symbols (e.g., "WETH", "USDC", "ARB")
- Use contract addresses (0x followed by 40 hex characters) for any token
- AI assistant can help you find tokens by name

## Development

### Available Scripts

```bash
# Start development server with Turbopack (hot reload enabled)
npm run dev

# Build for production with Turbopack
npm run build

# Start production server
npm start

# Run ESLint
npm run lint

# Test CoW Protocol SDK integration (without starting UI)
node test-cowswap-sdk.js
```

### Development Notes

- The dev server runs on http://localhost:3000 by default
- Turbopack is used for both development and production builds for faster compilation
- Hot reload is enabled - changes to files will auto-update the browser
- Always test on testnet first before using with real funds
- Use `node test-cowswap-sdk.js` to test CoW Protocol integration without the UI

## Important Notes

### CoW Protocol Trading
- **Intent-Based**: Orders are submitted to batch auctions, not executed immediately
- **MEV Protection**: Batch auction system protects against MEV attacks
- **Gas Subsidies**: Many swaps have subsidized or free gas (depends on order size and market conditions)
- **Order Status**: Track your orders on CoW Explorer (https://explorer.cow.fi/)
- **Slippage**: Default slippage tolerance is 0.5%

### Security & Best Practices
- **Testnet First**: Always test new features on testnet before using mainnet
- **Token Approval**: First-time swaps require token approval transactions
- **Wallet Security**: Never share your private keys, seed phrases, or sign suspicious transactions
- **Double Check**: Always verify token addresses and amounts before confirming transactions
- **RPC Rate Limits**: Consider using custom RPC endpoints for better performance and rate limits

### Network Requirements
- **Chain Selection**: Make sure your wallet is on the correct network (Arbitrum or BNB Chain)
- **Gas Fees**: Keep native tokens (ETH on Arbitrum, BNB on BNB Chain) for gas fees
- **Token Support**: Use the AI to check if a specific token is available on your desired chain

## Contributing

We welcome contributions! Please read the following guidelines before getting started.

### Repository Guidelines

See `AGENTS.md` and `CLAUDE.md` for detailed development guidelines. Key points:

**Project Structure:**
- Next.js 15 App Router lives under `src/app`
- `page.tsx` hosts the chat UI
- `app/api/chat/route.ts` handles AI requests
- Shared UI components in `src/components`
- Protocol and token logic in `src/lib`

**Code Style:**
- TypeScript with explicit return types on exported functions
- Two-space indentation, double quotes, semicolons
- PascalCase for components (`Chat`, `WalletConnect`)
- camelCase for utility modules (`swapClient.ts`)
- Tailwind classes: group structural utilities before color tokens

**Testing:**
- Run `npm run lint` before committing
- Test protocol changes with `node test-cowswap-sdk.js`
- Document manual test scenarios in PR descriptions
- Use `./scripts/check-tool-messages.sh` to validate AI tool conventions

**AI Tool Convention (CRITICAL):**
- Every tool MUST return a `message` (success) or `userMessage` (error) field
- This ensures users always see feedback, even if AI stops after tool calls
- See `TOOL_CONVENTION.md` for detailed examples
- Run `./scripts/check-tool-messages.sh` before committing changes to tools

**Commit Messages:**
- Use concise, imperative messages (e.g., "add token balance feature", "fix quote formatting")
- Keep subject ≤ 60 characters
- Start with lowercase verb

**Pull Requests:**
- Provide one-paragraph summary of changes
- Include screenshots/terminal logs for UI or protocol changes
- List executed commands and test scenarios
- Note any new environment variables needed

### Adding New Features

**Adding a New Chain:**
1. Add chain ID to `src/lib/chains.ts`
2. Update `src/lib/wagmi.ts` with chain config
3. Add RPC URL to environment variables
4. Update token list sources in `src/lib/tokens.ts`
5. Test with the AI chat interface

**Adding a New AI Tool:**
1. Define tool schema in `src/app/api/chat/route.ts`
2. Implement execute function with proper error handling
3. **MUST** include `message` or `userMessage` in all return statements
4. Run `./scripts/check-tool-messages.sh` to validate
5. Test thoroughly with the chat interface
6. Update `TOOL_CONVENTION.md` if introducing new patterns

**Adding New Token Sources:**
1. Add token list URL to `src/lib/tokens.ts`
2. Update token fetching logic with proper error handling
3. Test with various token symbols and addresses
4. Update token cache TTL if needed

### Environment & Secrets

- Add new config keys to environment variables section in README
- Never commit API keys or wallet secrets
- Use `.env.local` for local development
- Document expected chain IDs and RPC providers

## Troubleshooting

### "No route found" or "No quote available" error

- Ensure sufficient liquidity exists for the token pair on CoW Protocol
- Try a smaller trade amount
- Check that both tokens are supported on the selected chain
- Verify the token symbols or addresses are correct
- Try again in a few moments (liquidity can change)

### Wallet connection issues

- Clear browser cache and cookies
- Try a different wallet (MetaMask, WalletConnect, Coinbase Wallet)
- Ensure your wallet is on the correct network (Arbitrum or BNB Chain)
- Check that WalletConnect Project ID is correctly set in `.env.local`
- Refresh the page and try connecting again

### Order submission failures

- Ensure you have enough native tokens for gas (ETH on Arbitrum, BNB on BNB Chain)
- Verify token approval was successful (check wallet transaction history)
- Ensure sufficient token balance for the swap
- Check if the token requires approval and retry after approving
- Verify you're on the correct network

### AI not responding or blank messages

- Check browser console for errors
- Verify `OPENAI_API_KEY` is correctly set
- Ensure you're connected to the internet
- Try refreshing the page
- If tools are executing but no messages appear, this indicates a tool convention violation - check logs

### Token not found errors

- Verify the token exists on the selected chain
- Try using the token's contract address instead of symbol
- Check token list sources are accessible
- Clear cache and retry: token lists are cached for 1 hour

## Documentation

### Project Documentation
- `CLAUDE.md` - Development guide and AI tool conventions
- `AGENTS.md` - Repository structure and contribution guidelines
- `TOOL_CONVENTION.md` - Critical rules for AI tool development
- `COWSWAP_INTEGRATION.md` - CoW Protocol integration details
- `SUSHISWAP_INTEGRATION.md` - SushiSwap API integration guide
- `TESTING_CHECKLIST.md` - Testing guidelines and checklist

### External Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [CoW Protocol Documentation](https://docs.cow.fi/)
- [CoW Protocol SDK](https://github.com/cowprotocol/cow-sdk)
- [RainbowKit](https://www.rainbowkit.com/docs/introduction)
- [Wagmi Documentation](https://wagmi.sh/)
- [Viem Documentation](https://viem.sh/)
- [SushiSwap API](https://docs.sushi.com/)
- [Uniswap Token Lists](https://tokenlists.org/)

## Architecture Highlights

### Intent-Based Trading with CoW Protocol

DexLuthor uses CoW Protocol's innovative intent-based trading system:

1. **User Intent**: User describes desired trade in natural language
2. **Quote Generation**: AI fetches real-time quote from CoW Protocol
3. **Order Signing**: User signs order locally (no immediate execution)
4. **Batch Auction**: Order enters batch auction for optimal execution
5. **MEV Protection**: Batch system protects against front-running
6. **Settlement**: Best execution price achieved through solver competition

### Multi-Chain Token Resolution

Token resolution works across multiple sources:

1. **Primary**: Uniswap token list (1,000+ tokens, 20+ chains)
2. **Secondary**: PancakeSwap token list (BNB Chain specific)
3. **Fallback**: Direct contract address support
4. **Caching**: 1-hour TTL in-memory cache for performance

### AI-Powered Trade Flow

```
User Message → GPT-4 → Tool Selection → CoW Protocol API → Quote Display
     ↓                                                              ↓
Wallet Sign → Order Submission → Batch Auction → Settlement → Success
```

## Roadmap

### Planned Features
- [ ] Ethereum Mainnet support
- [ ] Polygon and Base support
- [ ] Historical trade tracking
- [ ] Price alerts and notifications
- [ ] Portfolio analytics dashboard
- [ ] Multi-hop swap optimization
- [ ] Limit orders via CoW Protocol
- [ ] Gas price optimization
- [ ] Mobile-responsive improvements

### Under Consideration
- [ ] Additional DEX integrations (1inch, Paraswap)
- [ ] Cross-chain swaps via bridges
- [ ] NFT trading support
- [ ] DeFi position management (lending, staking)
- [ ] Social features (share trades, leaderboards)

## License

MIT

## Disclaimer

This is an educational and experimental application. **Use at your own risk.**

- Always verify token addresses and amounts before confirming transactions
- Start with small amounts on testnet to familiarize yourself with the interface
- The developers are not responsible for any losses incurred while using this application
- CoW Protocol orders may take time to execute depending on market conditions
- Not all tokens have sufficient liquidity for trading
- Gas fees and trading fees apply as per the blockchain network and protocol

**This is not financial advice. Do your own research before trading any cryptocurrency.**
