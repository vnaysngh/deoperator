'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useEffect, useState } from 'react'

export function WalletConnect() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const [mounted, setMounted] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle connection errors
  useEffect(() => {
    if (connectError) {
      // Filter out extension-related errors that aren't critical
      const isExtensionError =
        connectError.message?.includes('chrome.runtime') ||
        connectError.message?.includes('Extension ID')

      if (!isExtensionError) {
        setLocalError(connectError.message)
        setTimeout(() => setLocalError(null), 5000)
      }
    }
  }, [connectError])

  const handleConnect = async (connectorToConnect: typeof connectors[0]) => {
    try {
      setLocalError(null)
      await connect({ connector: connectorToConnect })
    } catch (error) {
      // Catch any connection errors
      const isExtensionError =
        error instanceof Error &&
        (error.message?.includes('chrome.runtime') ||
          error.message?.includes('Extension ID'))

      if (!isExtensionError) {
        console.error('Failed to connect wallet:', error)
        setLocalError(
          error instanceof Error ? error.message : 'Failed to connect wallet'
        )
        setTimeout(() => setLocalError(null), 5000)
      }
    }
  }

  // Prevent hydration mismatch by not rendering dynamic content until client-side mount
  if (!mounted) {
    return (
      <div className="px-6 py-2.5 glass rounded-xl text-sm text-gray-400 border border-white/10">
        Loading...
      </div>
    )
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <div className="px-4 py-2 glass rounded-xl text-sm font-mono text-gray-300 border border-emerald-500/30">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            {address.slice(0, 6)}...{address.slice(-4)}
          </div>
        </div>
        <button
          onClick={() => disconnect()}
          className="px-4 py-2 glass rounded-xl text-sm text-gray-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/30 border border-white/10 transition-all"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {localError && (
        <div className="px-3 py-1.5 glass rounded-lg text-xs text-red-400 border border-red-500/30">
          {localError}
        </div>
      )}
      <div className="flex gap-2">
        {connectors.length > 0 ? (
          connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => handleConnect(connector)}
              className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-500 hover:to-primary-600 transition-all font-medium shadow-glow hover:shadow-glow-lg"
            >
              Connect Wallet
            </button>
          ))
        ) : (
          <div className="px-4 py-2 glass rounded-xl text-sm text-gray-400 border border-white/10">
            No wallet detected
          </div>
        )}
      </div>
    </div>
  )
}
