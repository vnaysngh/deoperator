# Uniswap Chat Trader

A modern, AI-powered interface for trading on Uniswap using natural language. Built with Next.js 15, Vercel AI SDK, and Uniswap SDK.

## Features

- **Natural Language Trading**: Simply describe what you want to trade in plain English
- **AI-Powered Assistant**: GPT-4 powered chatbot understands trade requests and provides quotes
- **Real-time Quotes**: Get instant price quotes from Uniswap before executing trades
- **Wallet Integration**: Secure wallet connection using Wagmi and WalletConnect
- **Direct Execution**: Trades execute directly through Uniswap smart contracts
- **Multi-Token Support**: Trade popular tokens including WETH, USDC, USDT, DAI, WBTC, and UNI

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **AI**: Vercel AI SDK with OpenAI GPT-4
- **Web3**: Wagmi, Viem, Ethers.js v6
- **DeFi**: Uniswap SDK (v3-sdk, smart-order-router)
- **State Management**: TanStack React Query

## Prerequisites

- Node.js 18+ and npm
- An Ethereum wallet (MetaMask, WalletConnect-compatible wallet, etc.)
- OpenAI API key
- Ethereum RPC endpoint (Infura, Alchemy, or similar)
- WalletConnect Project ID

## Getting Started

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd unipilot
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

# Ethereum RPC URL (get from https://infura.io or https://alchemy.com)
NEXT_PUBLIC_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID

# WalletConnect Project ID (get from https://cloud.walletconnect.com/)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Chain ID (1 for Ethereum Mainnet, 11155111 for Sepolia testnet)
NEXT_PUBLIC_CHAIN_ID=1
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
unipilot/
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
│       ├── wagmi.ts                # Wagmi configuration
│       ├── tokens.ts               # Token addresses & utilities
│       └── uniswap.ts              # Uniswap trading functions
├── .env.local                      # Environment variables (create this)
├── .env.example                    # Environment template
└── package.json
```

## Key Components

### AI Chat API (`src/app/api/chat/route.ts`)
- Handles natural language processing with GPT-4
- Implements tool calling for:
  - `getSwapQuote`: Fetches price quotes from Uniswap
  - `executeSwap`: Prepares swap transaction data
  - `getTokenInfo`: Returns token details

### Uniswap Integration (`src/lib/uniswap.ts`)
- `getSwapQuote()`: Uses AlphaRouter to find optimal swap routes
- `executeSwap()`: Executes token swaps via Uniswap V3 Router
- `getTokenBalance()`: Queries ERC20 token balances

### Chat UI (`src/components/Chat.tsx`)
- Built with Vercel AI SDK's `useChat` hook
- Real-time message streaming
- Tool invocation display
- Transaction execution triggering

## Supported Networks

- Ethereum Mainnet (Chain ID: 1)
- Sepolia Testnet (Chain ID: 11155111)

To switch networks, update `NEXT_PUBLIC_CHAIN_ID` in `.env.local` and add corresponding token addresses in `src/lib/tokens.ts`.

## Supported Tokens

**Mainnet:**
- WETH (Wrapped Ether)
- USDC (USD Coin)
- USDT (Tether USD)
- DAI (Dai Stablecoin)
- WBTC (Wrapped Bitcoin)
- UNI (Uniswap)

**Sepolia:**
- WETH (Wrapped Ether)
- USDC (USD Coin)

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
- [Uniswap V3 SDK](https://docs.uniswap.org/sdk/v3/overview)
- [Wagmi Documentation](https://wagmi.sh/)
- [Viem Documentation](https://viem.sh/)

## License

MIT

## Disclaimer

This is a demo application for educational purposes. Use at your own risk. Always verify transactions before confirming. The developers are not responsible for any losses incurred while using this application.
