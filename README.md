# DeOperator

An AI-powered DeFi assistant that simplifies blockchain interactions across multiple protocols using natural language. Built with Next.js 15, Vercel AI SDK, and integrated with leading DeFi protocols.

## What is DeOperator?

DeOperator is an intelligent interface that makes decentralized finance accessible to everyone. Instead of navigating complex UIs and understanding technical jargon, users can simply describe what they want to do in plain English. The AI assistant understands your intent, fetches real-time data, and executes transactions across multiple DeFi protocols.

## Problem Statement

DeFi is powerful but intimidating. Users face several challenges:

- **Complexity Overload**: Each protocol has its own interface, terminology, and workflow
- **Fragmented Experience**: Managing positions across multiple chains and protocols requires juggling different apps
- **Information Scattered**: Price data, transaction history, and DeFi positions live in separate places
- **High Learning Curve**: Understanding gas fees, slippage, liquidity, and protocol mechanics is overwhelming

DeOperator solves these problems by providing a unified, conversational interface where users can trade tokens, bridge assets, stake in lending protocols, track DeFi positions, monitor transactions, and explore prediction markets—all from one place, using natural language.

## Features & Pages

DeOperator offers a comprehensive suite of DeFi tools across multiple pages:

### 1. Trade Page (Main Interface)
- **Natural Language Trading**: Describe trades in plain English (e.g., "Swap 1 ETH for USDC")
- **AI-Powered Assistant**: GPT-4 understands complex trade requests and provides intelligent quotes
- **CoW Protocol Integration**: Get MEV-protected, batch auction trades with optimal execution
- **Real-time Quotes**: Instant intent-based quotes with price, slippage, and fee breakdowns
- **Token Approval & Execution**: Seamless approval flows and one-click trade execution
- **Cross-Chain Bridging**: Bridge assets between Ethereum, Arbitrum, and Base using Across Protocol
- **Morpho Staking**: Discover and deposit into top USDC/WETH yield vaults across networks
- **Multi-Token Support**: Trade 1000+ tokens with automatic address resolution via CoinGecko
- **Price Discovery**: Real-time USD prices via Moralis for accurate value calculations
- **Wallet Balance Checks**: AI can check your balances before suggesting trades

### 2. DeFi Positions Page
- **Portfolio Tracking**: View all your DeFi positions across protocols in one dashboard
- **Multi-Protocol Support**: Track liquidity pools, staking positions, and lending positions
- **Real-time Valuations**: USD values for all positions powered by Moralis
- **Protocol Integration**: See positions from Uniswap, Aave, Curve, and more
- **Position Analytics**: Total value, protocol breakdown, and asset distribution summaries
- **AI Chat Assistant**: Ask questions about your positions and get intelligent insights
- **Direct Protocol Links**: Quick access to manage positions on native protocol interfaces

### 3. Transactions Page
- **Complete Transaction History**: Chronological view of all wallet transactions
- **Multi-Chain Support**: Track transactions across Ethereum, Arbitrum, and Optimism
- **Transaction Details**: View gas fees, block numbers, timestamps, and transaction status
- **Address Labels**: Human-readable labels for known contracts and addresses
- **Infinite Scroll**: Load more transactions on-demand for deep history analysis
- **AI Intelligence**: Chat with an AI assistant to analyze transaction patterns and spending
- **Explorer Links**: Direct links to block explorers for detailed investigation

### 4. PolyIntelligence (Polymarket Markets)
- **Live Prediction Markets**: Browse and explore trending Polymarket markets
- **Market Analytics**: View volume, liquidity, and open interest metrics
- **Category Filtering**: Filter markets by Crypto, Politics, Sports, and more
- **Largest Trades Feed**: Real-time feed of the biggest trades in the last 24 hours
- **Market Details**: Comprehensive market information including close dates and descriptions
- **Trading View**: Direct links to trade on Polymarket
- **AI Market Insights**: Chat with AI to understand market trends and get recommendations

### 5. BasedCreators (Zora Creator Coins)
- **Creator Coin Discovery**: Explore trending creator coins on Base via Zora
- **Real-time Metrics**: Market cap, 24h volume, price changes, and holder counts
- **Multiple Views**: New launches, trending coins, top gainers, and most valuable
- **Market Cap Filtering**: Filter coins by minimum market cap thresholds
- **Safety Warnings**: Alerts for new coins with low liquidity
- **Coin Details**: Full information including creator profiles and token descriptions
- **Direct Trading**: Quick links to trade on Uniswap with contract verification
- **Pagination**: Browse through extensive coin listings with efficient pagination

### Cross-Cutting Features
- **Unified Sidebar Navigation**: Easy access to all features from any page
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Dark Mode UI**: Beautiful glass-morphism design with gradient accents
- **Wallet Integration**: Seamless connection with MetaMask, WalletConnect, and Base Account
- **Real-time Data**: Live updates for prices, positions, and market data
- **Error Handling**: Graceful error messages with actionable retry options

## Tech Stack

### Frontend & Core
- **Framework**: Next.js 15.5.4 with App Router architecture
- **React**: React 19.1.0 & React DOM 19.1.0
- **TypeScript**: Type-safe development with TypeScript 5
- **Styling**: Tailwind CSS v4 with PostCSS plugin
- **Bundler**: Turbopack for fast development and production builds
- **UI Components**: Radix UI primitives (Dialog, Tooltip, Separator, Slot, Alert Dialog)
- **Icons**: Lucide React for modern, consistent iconography
- **Utilities**: clsx, tailwind-merge, class-variance-authority for styling utilities

### AI & Intelligence
- **Vercel AI SDK**: Core AI streaming and tool calling (v5.0.68)
- **AI Models**:
  - OpenAI GPT-4 (@ai-sdk/openai)
  - Anthropic Claude (@ai-sdk/anthropic)
  - Google Gemini (@ai-sdk/google)
- **Client SDK**: @ai-sdk/react for React hooks

### Web3 & Wallet
- **Wagmi**: v2.18.1 for React hooks and wallet management
- **Viem**: v2.38.3 for Ethereum interactions and type-safe contract calls
- **Reown AppKit**: v1.8.10 with Wagmi adapter for WalletConnect v2
- **Coinbase OnchainKit**: v1.1.1 for Base ecosystem integration

### DeFi Protocols
- **CoW Protocol**:
  - @cowprotocol/cow-sdk v7.0.8
  - @cowprotocol/sdk-trading v0.3.2
  - @cowprotocol/sdk-order-book v0.1.2
  - @cowprotocol/sdk-viem-adapter v0.1.2
- **Morpho Blue**:
  - @morpho-org/blue-sdk v5.2.0
  - @morpho-org/blue-sdk-viem v4.0.0
  - @morpho-org/morpho-ts v2.4.3
- **Across Protocol**: @across-protocol/app-sdk v0.4.2
- **Zora**: @zoralabs/coins-sdk v0.3.2
- **Uniswap**:
  - @uniswap/sdk-core v7.7.2
  - @uniswap/v3-sdk v3.25.2
  - @uniswap/v4-sdk v1.21.4

### Data & APIs
- **Moralis**: Web3 Data API for wallet balances, transactions, and DeFi positions
- **CoinGecko**: Token price data and token metadata lookups
- **Polymarket**: Live prediction market data and trade feeds
- **Zora API**: Creator coin data and analytics

### State Management & Caching
- **TanStack React Query**: v5.90.5 for async state management and caching
- **Prisma**: v6.17.1 for database operations and data persistence
- **PostgreSQL**: Database for caching market data and trade history

### Validation & Utilities
- **Zod**: v4.1.12 for runtime type validation and schema parsing
- **Next.js Image**: Optimized image loading and rendering

## Prerequisites

- **Node.js**: Version 18 or higher
- **Package Manager**: npm (comes with Node.js)
- **Ethereum Wallet**: MetaMask, WalletConnect-compatible wallet, or Coinbase Smart Wallet
- **Database** (Optional): PostgreSQL for Prisma data persistence
- **API Keys** (See configuration section below):
  - OpenAI API key (required for AI features)
  - WalletConnect Project ID (required for wallet connection)
  - Moralis Web3 API key (required for positions, transactions, prices)
  - CoinGecko Demo API key (required for token lookups)
  - Zora API key (optional, for basedCreators page - falls back to public endpoints)

## Getting Started

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd deoperator
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# ===== REQUIRED =====

# OpenAI API Key (get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-...

# WalletConnect Project ID (get from https://cloud.walletconnect.com/)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# Moralis Web3 API Key (get from https://admin.moralis.io/)
MORALIS_API_KEY=your_moralis_api_key_here

# CoinGecko Demo API Key (get from https://www.coingecko.com/en/api)
COINGECKO_DEMO_API_KEY=your_coingecko_demo_key_here

# ===== OPTIONAL =====

# Database URL for Prisma (optional, for caching Polymarket data)
# If not provided, app will work without persistent caching
DATABASE_URL=postgresql://user:password@localhost:5432/deoperator

# Zora API Key (optional, for basedCreators page - falls back to public endpoints)
ZORA_API_KEY=your_zora_api_key_here

# RPC Endpoints (optional - defaults to public RPCs)
NEXT_PUBLIC_MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_ARBITRUM_RPC_URL=https://arbitrum-one.public.blastapi.io

# CoW Protocol partner fee recipient (optional - for revenue sharing)
# If not provided, trades work without partner fees
NEXT_PUBLIC_PARTNER_FEE_RECIPIENT=0xYourPartnerFeeRecipientAddress

# Alternative AI Providers (optional)
# Uncomment to use Anthropic or Google models
# ANTHROPIC_API_KEY=your_anthropic_key
# GOOGLE_GENERATIVE_AI_API_KEY=your_google_key
```

### 3. Set Up Database (Optional)

If you want to enable Polymarket data caching:

```bash
# Install PostgreSQL locally or use a hosted service (Neon, Supabase, etc.)

# Run migrations
npm run prisma:migrate-deploy

# Generate Prisma Client
npm run prisma:generate
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Getting Started
1. **Connect Your Wallet**: Click "Connect Wallet" in the top-right corner
2. **Select a Network**: Choose Ethereum, Arbitrum, or Base
3. **Navigate**: Use the sidebar to access different features

### Trade Page (AI Assistant)
Natural language commands for trading, bridging, and staking:

**Trading Examples:**
- "Swap 1 WETH for USDC"
- "Trade 0.5 ETH for USDT on Arbitrum"
- "Get me a quote for 100 USDC to DAI"
- "What's the price of WBTC?"
- "Show me my USDC balance"

**Bridging Examples:**
- "Bridge 250 USDC from Arbitrum to Base"
- "Move 0.1 ETH from Ethereum to Arbitrum"
- "How much does it cost to bridge USDT to Base?"

**Staking Examples:**
- "What are the staking options for USDC on Base?"
- "Show me WETH vaults on Ethereum"
- "I want to stake 1000 USDC in a safe vault"

The AI will:
1. Understand your intent and validate parameters
2. Fetch real-time quotes with price impact and fees
3. Display clear information and ask for confirmation
4. Execute the transaction when you approve

### DeFi Positions Page
- **View Portfolio**: See all your liquidity pools, staking positions, and lending positions
- **Filter by Protocol**: Click on protocols to see specific positions
- **Ask Questions**: Use the floating chat to ask "What's my total portfolio value?" or "Which protocol has my highest position?"
- **Direct Links**: Click "Open →" to manage positions on the native protocol

### Transactions Page
- **Browse History**: Scroll through your complete transaction history
- **Load More**: Click "Load more" to see older transactions
- **View Details**: Click any transaction to see full details
- **Analyze Patterns**: Ask the AI assistant "How much did I spend on gas this month?" or "Show me my largest transactions"

### PolyIntelligence Page
- **Browse Markets**: Explore prediction markets sorted by volume or liquidity
- **Filter Categories**: Select Crypto, Politics, Sports, or other categories
- **View Trades**: Switch to "Largest trades (24h)" tab to see whale activity
- **Get Insights**: Ask the AI "What are the trending crypto markets?" or "Explain this market to me"
- **Trade**: Click any market to see details and trade on Polymarket

### BasedCreators Page
- **Discover Coins**: Explore creator coins by trending, new launches, or top gainers
- **Filter**: Set minimum market cap thresholds
- **View Details**: Click any coin to see full information
- **Safety First**: Pay attention to warnings for new/low liquidity coins
- **Trade**: Click "Trade on Uniswap" to trade (always verify contracts first!)

## Project Structure

```
deoperator/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/                    # API routes
│   │   │   ├── chat/
│   │   │   │   └── route.ts        # Main AI chat API with tool calling
│   │   │   ├── defi-positions/
│   │   │   │   └── route.ts        # DeFi positions API (Moralis)
│   │   │   ├── transactions/
│   │   │   │   └── route.ts        # Transaction history API (Moralis)
│   │   │   ├── polymarket/
│   │   │   │   └── markets/
│   │   │   │       └── route.ts    # Polymarket markets & trades API
│   │   │   └── zora/
│   │   │       └── creator-coins/
│   │   │           └── route.ts    # Zora creator coins API
│   │   ├── trade/                  # Trading page
│   │   │   ├── page.tsx            # Main trade interface
│   │   │   └── [sessionId]/
│   │   │       └── page.tsx        # Persistent chat sessions
│   │   ├── positions/
│   │   │   └── page.tsx            # DeFi positions dashboard
│   │   ├── transactions/
│   │   │   └── page.tsx            # Transaction history page
│   │   ├── poly-intelligence/
│   │   │   └── page.tsx            # Polymarket markets explorer
│   │   ├── based-creators/
│   │   │   └── page.tsx            # Zora creator coins page
│   │   ├── layout.tsx              # Root layout with providers
│   │   ├── page.tsx                # Home page (redirects to /trade)
│   │   └── globals.css             # Global Tailwind styles
│   ├── components/                 # React components
│   │   ├── Chat.tsx                # Main chat UI with streaming
│   │   ├── WalletConnect.tsx       # Wallet connection button
│   │   ├── Providers.tsx           # Wagmi & React Query providers
│   │   ├── app-sidebar.tsx         # Navigation sidebar
│   │   ├── FloatingPositionsChat.tsx    # AI assistant for positions
│   │   ├── FloatingTransactionsChat.tsx # AI assistant for transactions
│   │   ├── PolymarketChat.tsx      # AI assistant for Polymarket
│   │   ├── PositionsIntelligence.tsx    # Positions page AI chat
│   │   ├── TransactionsIntelligence.tsx # Transactions page AI chat
│   │   ├── chat/                   # Chat-specific components
│   │   │   ├── BridgeQuoteCard.tsx
│   │   │   ├── CreateOrderButton.tsx
│   │   │   ├── MorphoStakingCard.tsx
│   │   │   ├── OrderSubmit.tsx
│   │   │   └── QuoteDisplay.tsx
│   │   └── ui/                     # Radix UI components
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       ├── sheet.tsx
│   │       ├── sidebar.tsx
│   │       ├── tooltip.tsx
│   │       └── ...
│   ├── lib/                        # Utilities & clients
│   │   ├── chains.ts               # Chain configs & helpers
│   │   ├── tokens.ts               # Token registry with fallbacks
│   │   ├── coingecko.ts            # CoinGecko API client
│   │   ├── prices.ts               # Moralis price lookups
│   │   ├── wallet-balances.ts      # Moralis balance helpers
│   │   ├── cowswap-client.ts       # CoW Protocol client
│   │   ├── morpho-client.ts        # Morpho Blue client
│   │   ├── across-client.ts        # Across bridge client
│   │   ├── polymarket.ts           # Polymarket data types
│   │   ├── polymarket-trades.ts    # Polymarket trade feed
│   │   ├── zora-client.ts          # Zora creator coins client
│   │   ├── wagmi.ts                # Wagmi configuration
│   │   ├── prisma.ts               # Prisma client
│   │   └── utils.ts                # Shared utilities
│   └── ...
├── prisma/
│   └── schema.prisma               # Database schema
├── scripts/
│   └── check-tool-messages.sh      # Pre-commit checker for AI tools
├── .env.local                      # Environment variables (create this)
├── .env.example                    # Environment template
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── CLAUDE.md                       # Claude Code project instructions
└── README.md
```

## Key Components & Architecture

### AI Chat API (`src/app/api/chat/route.ts`)

The core intelligence layer that powers natural language interactions:

- **Tool Calling System**: Implements structured function calling with GPT-4
- **Available Tools**:
  - `getSwapQuote`: Pre-validates tokens and liquidity before CoW Protocol quotes
  - `createOrder`: Prepares order parameters for client-side CoW SDK execution
  - `getBridgeQuote`: Fetches Across Protocol quotes with fees and timing
  - `getMorphoStakingOptions`: Discovers top yield vaults by TVL
  - `getTokenInfo`: Resolves token metadata via CoinGecko
  - `getTokenUSDPrice`: Real-time price lookups via Moralis
  - `getWalletBalances`: Complete wallet balance summaries
  - `getSpecificBalances`: Token-specific balance checks
- **Streaming**: Real-time message streaming for responsive UX
- **Error Handling**: Comprehensive error messages with fallback suggestions

### Protocol Integrations

**CoW Protocol Client (`src/lib/cowswap-client.ts`)**
- Browser-side SDK wrapper for CoW Protocol
- Order creation, signing, and submission
- Allowance checks and ERC-20 approvals
- Quote fetching with slippage protection

**Morpho Client (`src/lib/morpho-client.ts`)**
- GraphQL queries for vault discovery across chains
- ERC-4626 vault interactions (deposit, withdraw)
- APY calculations and TVL tracking
- Allowance management for vault deposits

**Across Bridge Client (`src/lib/across-client.ts`)**
- Cross-chain bridge quotes with fee breakdowns
- Supported tokens: ETH, USDC, USDT, DAI
- Supported routes: Ethereum ↔ Arbitrum ↔ Base
- Fee estimation and arrival time predictions

**Zora Client (`src/lib/zora-client.ts`)**
- Creator coin discovery and analytics
- Market metrics (volume, market cap, holders)
- Trending algorithms and filtering
- Direct Uniswap integration links

### Data Layer

**Moralis Integration**
- Wallet balances across chains (src/lib/wallet-balances.ts)
- USD price feeds (src/lib/prices.ts)
- Transaction history with pagination
- DeFi position tracking across protocols

**Token Resolution (src/lib/tokens.ts)**
- Curated token lists for major chains
- CoinGecko fallback for unknown tokens
- Contract address resolution
- Symbol → address mapping

**Prisma Database (src/lib/prisma.ts)**
- Polymarket data caching for performance
- Trade history persistence
- Market snapshot storage
- Reduces API calls and improves load times

### UI Components

**Chat Interface (`src/components/Chat.tsx`)**
- Vercel AI SDK's `useChat` hook for streaming
- Markdown rendering for AI responses
- Tool result visualization (quotes, bridge details)
- Transaction status tracking
- Error boundary with graceful fallbacks

**Floating AI Assistants**
- Context-aware chat for each page
- Access to page-specific data (positions, transactions, markets)
- Persistent across page interactions
- Minimizable and expandable UI

## Supported Networks

DeOperator supports the following EVM-compatible networks:

### Primary Networks (Full Feature Support)
- **Ethereum Mainnet** (Chain ID: 1)
  - CoW Protocol trading
  - Morpho vaults (USDC, WETH)
  - DeFi positions tracking
  - Transaction history
  - Cross-chain bridging (Across)

- **Base** (Chain ID: 8453)
  - CoW Protocol trading
  - Morpho vaults (USDC, WETH)
  - Zora creator coins
  - DeFi positions tracking
  - Transaction history
  - Cross-chain bridging (Across)

- **Arbitrum One** (Chain ID: 42161)
  - CoW Protocol trading
  - Morpho vaults (USDC, WETH)
  - DeFi positions tracking
  - Transaction history
  - Cross-chain bridging (Across)

### Additional Networks (View-Only Features)
- **Optimism** (Chain ID: 10) - Transaction history
- **Avalanche** (Chain ID: 43114) - Transaction history, positions
- **Fantom** (Chain ID: 250) - Transaction history, positions

## Supported Tokens

Token discovery uses multiple strategies for maximum coverage:

### Curated Token Lists
- Uniswap default token list
- CoW Protocol token list
- Chain-specific lists (Base, Arbitrum)

### Popular Tokens by Chain

**Ethereum:**
- Native: ETH (wrapped as WETH)
- Stablecoins: USDC, USDT, DAI, FRAX
- Major Assets: WBTC, LINK, UNI, AAVE, MKR

**Base:**
- Native: ETH (wrapped as WETH)
- Stablecoins: USDC, USDbC (bridged), DAI
- Base Ecosystem: cbETH, BALD, DEGEN
- Zora Creator Coins: 1000+ creator tokens

**Arbitrum:**
- Native: ETH (wrapped as WETH)
- Stablecoins: USDC, USDC.e (bridged), USDT, DAI
- Arbitrum Ecosystem: ARB, GMX, MAGIC, GNS

### Token Resolution
If a token isn't in the curated lists:
1. **CoinGecko Fallback**: Searches by symbol and chain
2. **Contract Address**: Accepts raw addresses (0x...)
3. **On-Chain Lookup**: Fetches metadata from blockchain

Example:
- "Swap PEPE for USDC" → CoinGecko resolves PEPE address
- "Swap 0x6982508145454Ce325dDbE47a25d4ec3d2311933 for USDC" → Direct address usage

## Development

### Build for Production

```bash
npm run build        # Uses Turbopack for fast builds
```

### Run Production Build

```bash
npm start           # Starts production server on port 3000
```

### Lint Code

```bash
npm run lint        # ESLint with Next.js config
```

### Database Operations

```bash
npm run prisma:generate        # Generate Prisma Client
npm run prisma:migrate-deploy  # Run database migrations
```

### Testing Token Lookups

```bash
# Test CoinGecko token resolution
COINGECKO_DEMO_API_KEY=your_key npm run test:lookup APEX arbitrum-one
```

### Development Best Practices

**AI Tool Development (CRITICAL)**
- Always read `CLAUDE.md` before modifying AI tools
- Every tool return MUST include `message` or `userMessage` fields
- Run `./scripts/check-tool-messages.sh` before committing changes to chat API
- Test tool responses in the UI to ensure proper rendering
- Never assume AI will respond after tool calls - provide fallback messages

**Code Quality**
- Use TypeScript strict mode - always provide types
- Run `npm run lint` before committing
- Use Zod for runtime validation of API responses
- Handle loading, error, and empty states in UI components

**Performance**
- Use React Query for caching API responses
- Set appropriate `staleTime` and `gcTime` for each query
- Lazy load heavy components and images
- Use Next.js Image component for optimized images

**Security**
- Never commit API keys or secrets
- Validate all user inputs with Zod schemas
- Sanitize contract addresses before blockchain calls
- Use environment variables for sensitive config

## Important Notes

### For Users
- **Gas Fees**: All transactions require native ETH for gas on respective chains
- **Token Approvals**: First-time token interactions require approval transactions
- **Slippage**: Default slippage tolerance is 0.5% (configurable in code)
- **MEV Protection**: CoW Protocol provides MEV protection through batch auctions
- **Security**: Never share private keys or seed phrases. Always verify transaction details before signing
- **New Tokens**: Exercise caution with new/low-liquidity tokens on basedCreators
- **Rate Limits**: Free API tiers have rate limits (Moralis, CoinGecko, Zora)

### Technical Considerations
- **AI Response Times**: First response may be slower due to cold starts
- **RPC Reliability**: Public RPCs may be slower; use dedicated endpoints for production
- **Database**: PostgreSQL is optional but recommended for better Polymarket performance
- **Caching**: React Query caches data to minimize API calls and improve UX
- **Error Handling**: Most errors include actionable user guidance
- **Mobile**: Fully responsive but desktop provides better chart/table experience

## Troubleshooting

### "No route found" error

- Ensure sufficient liquidity exists for the token pair
- Try a smaller trade amount
- Check that you're using supported tokens

### Wallet connection issues

- Clear browser cache and cookies
- Try a different wallet connector
- Ensure your wallet is on the correct network

### Transaction failures

- Check you have enough ETH for gas fees
- Verify token approval was successful
- Ensure sufficient token balance

## For New Contributors

Welcome to DeOperator! Here's how to get started as a new contributor:

### Understanding the Codebase

1. **Start Here**:
   - Read `CLAUDE.md` for project conventions and AI tool requirements
   - Review this README for architecture overview
   - Browse `src/app/` to understand the page structure

2. **Key Files to Understand**:
   - `src/app/api/chat/route.ts` - Core AI logic and tool definitions
   - `src/lib/chains.ts` - Network configurations
   - `src/lib/tokens.ts` - Token resolution system
   - `src/components/Chat.tsx` - Main chat interface

3. **Common Tasks**:

   **Adding a New AI Tool:**
   ```typescript
   // In src/app/api/chat/route.ts
   {
     name: "yourTool",
     description: "Clear description for the AI",
     parameters: z.object({
       param: z.string().describe("Parameter description")
     }),
     execute: async ({ param }) => {
       // Your logic here
       return {
         success: true,
         message: "User-friendly message", // REQUIRED!
         data: yourData
       };
     }
   }
   ```

   **Adding a New Page:**
   - Create `src/app/your-page/page.tsx`
   - Add route to `src/components/app-sidebar.tsx`
   - Create associated API routes in `src/app/api/`
   - Add reusable components in `src/components/`

   **Adding a New Protocol:**
   - Create client in `src/lib/your-protocol-client.ts`
   - Add AI tools in `src/app/api/chat/route.ts`
   - Create UI components in `src/components/`
   - Update README with supported features

4. **Testing Your Changes**:
   ```bash
   # Start dev server
   npm run dev

   # Test in browser at http://localhost:3000
   # Connect wallet and try features

   # Check for TypeScript errors
   npx tsc --noEmit

   # Run linter
   npm run lint
   ```

5. **Before Submitting PR**:
   - Test all affected features in the browser
   - Run `./scripts/check-tool-messages.sh` if you modified AI tools
   - Update README if you added new features
   - Ensure no TypeScript or lint errors
   - Test on mobile viewport for responsive design

### Architecture Patterns

**API Routes**: Server-side routes in `src/app/api/`
- Handle external API calls (Moralis, CoinGecko, etc.)
- Return structured JSON responses
- Use Zod for validation

**Client Components**: React components in `src/components/`
- Use "use client" directive for interactivity
- Leverage Wagmi hooks for Web3 interactions
- Use React Query for data fetching

**AI Integration**: Tools in `src/app/api/chat/route.ts`
- Always return `message` or `userMessage` in tool responses
- Use Zod schemas for parameter validation
- Handle errors gracefully with user-friendly messages

## Learn More

### Documentation
- [Next.js Documentation](https://nextjs.org/docs) - App Router, API routes, and server components
- [Vercel AI SDK](https://sdk.vercel.ai/docs) - AI streaming and tool calling
- [Wagmi Documentation](https://wagmi.sh/) - React hooks for Ethereum
- [Viem Documentation](https://viem.sh/) - TypeScript Ethereum library
- [TanStack Query](https://tanstack.com/query/latest) - Async state management

### Protocol Documentation
- [CoW Protocol Docs](https://docs.cow.fi/) - MEV-protected trading
- [Morpho Documentation](https://docs.morpho.org/) - Lending protocol
- [Across Protocol](https://docs.across.to/) - Cross-chain bridging
- [Zora Documentation](https://docs.zora.co/) - Creator coins and NFTs

### Data APIs
- [Moralis Web3 APIs](https://moralis.io/web3-data-api/) - Wallet data and DeFi positions
- [CoinGecko API](https://www.coingecko.com/api/documentation) - Token prices and metadata
- [Polymarket API](https://docs.polymarket.com/) - Prediction markets

## License

MIT

## Disclaimer

This is a demo application for educational purposes. Use at your own risk. Always verify transactions before confirming. The developers are not responsible for any losses incurred while using this application.
