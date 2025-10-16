# DexLuthor

A modern, AI-powered interface for trading through CoW Protocol using natural language. Built with Next.js 15, Vercel AI SDK, and Moralis data services.

## Features

- **Natural Language Trading**: Simply describe what you want to trade in plain English
- **AI-Powered Assistant**: GPT-4 powered chatbot understands trade requests and provides quotes
- **Real-time Quotes**: Get instant intent-based quotes from CoW Protocol before executing trades
- **Wallet Integration**: Secure wallet connection using Wagmi and WalletConnect
- **Direct Execution**: Trades execute directly through CoW Protocol batch auctions
- **Multi-Token Support**: Trade popular tokens including WETH, USDC, USDT, DAI, WBTC, and UNI

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **AI**: Vercel AI SDK with OpenAI GPT-4
- **Web3**: Wagmi, Viem, Ethers.js v6
- **DeFi**: CoW Protocol Trading SDK, Moralis API
- **State Management**: TanStack React Query

## Prerequisites

- Node.js 18+ and npm
- An Ethereum wallet (MetaMask, WalletConnect-compatible wallet, etc.)
- OpenAI API key
- Ethereum RPC endpoint (Infura, Alchemy, or similar)
- WalletConnect Project ID
- Moralis Web3 API key
- CoinGecko demo API key (get from https://www.coingecko.com/en/api)

## Getting Started

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd dexluthor
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# OpenAI API Key (get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-...

# WalletConnect Project ID (get from https://cloud.walletconnect.com/)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Optional RPC overrides (defaults fall back to public RPCs)
NEXT_PUBLIC_MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
NEXT_PUBLIC_BSC_RPC_URL=https://bsc-dataseed1.binance.org
NEXT_PUBLIC_POLYGON_RPC_URL=https://polygon-rpc.com
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_ARBITRUM_RPC_URL=https://arbitrum-one.public.blastapi.io

# Moralis Web3 API key (https://admin.moralis.io/)
MORALIS_API_KEY=your_moralis_api_key_here

# CoinGecko demo API key (https://www.coingecko.com/en/api)
COINGECKO_DEMO_API_KEY=your_coingecko_demo_key_here
```

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Connect Your Wallet**: Click "Connect Wallet" and select your preferred wallet
2. **Start Chatting**: Type natural language commands like:
   - "Swap 1 WETH for USDC"
   - "Get me a quote for 100 USDC to DAI"
   - "What's the price of WBTC?"
   - "Trade 0.5 ETH for USDT"
3. **Review & Confirm**: The AI will get a quote and ask for confirmation
4. **Execute Trade**: Confirm in your wallet to complete the swap

## Project Structure

```
dexluthor/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/
│   │   │       └── route.ts        # AI chat API with tool calling
│   │   ├── layout.tsx              # Root layout with providers
│   │   ├── page.tsx                # Main chat interface
│   │   └── globals.css             # Global styles
│   ├── components/
│   │   ├── Chat.tsx                # Chat UI component
│   │   ├── WalletConnect.tsx       # Wallet connection button
│   │   └── Providers.tsx           # Wagmi & React Query providers
│   └── lib/
│       ├── chains.ts               # Supported chain constants & helpers
│       ├── coingecko.ts            # CoinGecko search & metadata helpers
│       ├── cowswap-client.ts       # Client-side CoW Protocol SDK wrapper
│       ├── prices.ts               # Moralis USD price lookups
│       ├── tokens.ts               # Token registry with CoinGecko fallback
│       ├── wallet-balances.ts      # Moralis wallet balance helpers
│       └── wagmi.ts                # Wagmi configuration
├── .env.local                      # Environment variables (create this)
├── .env.example                    # Environment template
└── package.json
```

## Key Components

### AI Chat API (`src/app/api/chat/route.ts`)

- Handles natural language processing with GPT-4
- Implements tool calling for:
  - `getSwapQuote`: Resolves token metadata and performs liquidity pre-checks before the client fetches a CoW quote
  - `createOrder`: Supplies the client with all parameters needed for Trading SDK order creation
  - `getTokenInfo`: Returns token details
  - `getTokenUSDPrice`: Fetches USD pricing via Moralis
  - `getWalletBalances` / `getSpecificBalances`: Summaries and token-specific balances via Moralis

### CoW Protocol Client (`src/lib/cowswap-client.ts`)

- Wraps the CoW Protocol Trading SDK for browser-side quoting and order submission
- Provides helpers to check allowances and perform approvals where necessary

### Chat UI (`src/components/Chat.tsx`)

- Built with Vercel AI SDK's `useChat` hook
- Real-time message streaming
- Tool invocation display
- Transaction execution triggering

## Supported Networks

- Ethereum Mainnet (Chain ID: 1)
- BNB Chain (Chain ID: 56)
- Polygon PoS (Chain ID: 137)
- Base (Chain ID: 8453)
- Arbitrum One (Chain ID: 42161)

## Supported Tokens

Token discovery is handled dynamically via curated token lists and CoinGecko fallbacks. Popular assets include:

- **Ethereum**: WETH, USDC, USDT, DAI, WBTC
- **BNB Chain**: WBNB, CAKE, BTCB, USDC, USDT
- **Polygon**: WMATIC, WETH, USDC, USDT, DAI
- **Base**: WETH, USDC, cbETH, DAI, USDT
- **Arbitrum**: ARB, WETH, USDC, USDT, DAI

If a token symbol isn’t found, provide the contract address (0x…) and the assistant will resolve it through CoinGecko or on-chain lookups.

## Development

### Build for Production

```bash
npm run build
```

### Run Production Build

```bash
npm start
```

### Lint Code

```bash
npm run lint
```

### CoinGecko Token Lookup Smoke Test

```bash
COINGECKO_DEMO_API_KEY=your_key npm run test:lookup APEX arbitrum-one
```

## Important Notes

- **Testnet First**: Start by testing on Sepolia testnet before using mainnet
- **Gas Fees**: All transactions require ETH for gas fees
- **Token Approval**: First-time swaps require token approval transactions
- **Slippage**: Default slippage tolerance is 0.5%, adjustable in the code
- **Security**: Never share your private keys or seed phrases

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

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [CoW Protocol Docs](https://docs.cow.fi/)
- [Moralis Web3 APIs](https://moralis.io/web3-data-api/)
- [Wagmi Documentation](https://wagmi.sh/)
- [Viem Documentation](https://viem.sh/)

## License

MIT

## Disclaimer

This is a demo application for educational purposes. Use at your own risk. Always verify transactions before confirming. The developers are not responsible for any losses incurred while using this application.
