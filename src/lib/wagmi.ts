import { http, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

// Metadata for WalletConnect
const metadata = {
  name: 'UniPilot',
  description: 'AI-Powered Uniswap Trading',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://unipilot.app',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
}

// Get connectors safely - only on client side
function getConnectors() {
  const connectors = []

  // Only add injected connector if we're in a browser environment
  if (typeof window !== 'undefined') {
    try {
      connectors.push(injected())
    } catch (error) {
      console.warn('Failed to initialize injected connector:', error)
    }
  }

  // Add WalletConnect if project ID is available
  if (projectId) {
    try {
      connectors.push(
        walletConnect({
          projectId,
          metadata,
          showQrModal: true,
        })
      )
    } catch (error) {
      console.warn('Failed to initialize WalletConnect connector:', error)
    }
  }

  return connectors
}

export const config = createConfig({
  chains: [mainnet, sepolia],
  connectors: getConnectors(),
  transports: {
    [mainnet.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
    [sepolia.id]: http(),
  },
  ssr: true,
})
