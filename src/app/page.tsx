'use client'

import { Chat } from '@/components/Chat'
import { WalletConnect } from '@/components/WalletConnect'
import { useAccount, useWalletClient } from 'wagmi'
import { providers } from 'ethers'
import { executeSwapClient } from '@/lib/swapClient'
import { useState } from 'react'

export default function Home() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [isExecuting, setIsExecuting] = useState(false)
  const [status, setStatus] = useState('')

  const handleExecuteSwap = async (transactionData: {
    fromToken: string
    toToken: string
    amount: string
    slippage: string
  }) => {
    if (!walletClient || !address) {
      setStatus('Please connect your wallet first')
      return
    }

    try {
      setIsExecuting(true)
      setStatus('Getting swap quote...')

      const quoteResponse = await fetch('/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromToken: transactionData.fromToken,
          toToken: transactionData.toToken,
          amount: transactionData.amount,
          slippage: transactionData.slippage,
        }),
      })

      const quoteData = await quoteResponse.json()

      if (!quoteData.success) {
        throw new Error(quoteData.error || 'Failed to get quote')
      }

      setStatus('Preparing transaction...')

      const provider = new providers.Web3Provider(walletClient as unknown as providers.ExternalProvider)
      const signer = provider.getSigner()

      setStatus(`Executing swap: ${transactionData.amount} ${transactionData.fromToken} → ${transactionData.toToken}`)

      const receipt = await executeSwapClient(
        transactionData.fromToken,
        transactionData.toToken,
        transactionData.amount,
        quoteData.quote.outputAmount,
        address,
        signer,
        parseFloat(transactionData.slippage)
      )

      setStatus(`Swap successful! Transaction: ${receipt.transactionHash}`)
      console.log('Swap completed:', receipt)
    } catch (error) {
      console.error('Swap failed:', error)
      setStatus(`Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center shadow-glow">
                <span className="text-white font-bold text-lg">U</span>
              </div>
              <span className="text-xl font-bold gradient-text">UniPilot</span>
            </div>
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12 mt-8">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4">
            <span className="gradient-text">AI-Powered</span>
            <br />
            <span className="text-white">Uniswap Trading</span>
          </h1>
          <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto">
            Trade tokens using natural language. No complex forms, just tell the AI what you want.
          </p>
        </div>

        {/* Status Messages */}
        {status && (
          <div className="max-w-3xl mx-auto mb-6">
            <div className={`glass-strong rounded-xl p-4 border ${
              status.includes('failed') || status.includes('error')
                ? 'border-red-500/30 bg-red-500/10'
                : status.includes('successful')
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'border-primary-500/30 bg-primary-500/10'
            }`}>
              <p className={`text-sm ${
                status.includes('failed') || status.includes('error')
                  ? 'text-red-400'
                  : status.includes('successful')
                  ? 'text-emerald-400'
                  : 'text-primary-400'
              }`}>
                {status}
              </p>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isExecuting && (
          <div className="max-w-3xl mx-auto mb-6">
            <div className="glass-strong rounded-xl p-4 border border-primary-500/30">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-gray-300">Processing transaction...</span>
              </div>
            </div>
          </div>
        )}

        {/* Chat Interface */}
        <div className="max-w-4xl mx-auto mb-12">
          <Chat walletAddress={address} onExecuteSwap={handleExecuteSwap} />
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
          <div className="glass rounded-2xl p-6 hover:bg-white/5 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary-600/20 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Natural Language</h3>
            <p className="text-sm text-gray-400">
              Simply describe what you want to trade. No forms, no complexity.
            </p>
          </div>

          <div className="glass rounded-2xl p-6 hover:bg-white/5 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary-600/20 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Real-time Quotes</h3>
            <p className="text-sm text-gray-400">
              Get instant price quotes from Uniswap before executing.
            </p>
          </div>

          <div className="glass rounded-2xl p-6 hover:bg-white/5 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary-600/20 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Secure Execution</h3>
            <p className="text-sm text-gray-400">
              All trades execute through your connected wallet securely.
            </p>
          </div>
        </div>

        {/* Supported Tokens */}
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-3">Supported Tokens</p>
          <div className="flex flex-wrap justify-center gap-2">
            {['WETH', 'USDC', 'USDT', 'DAI', 'WBTC', 'UNI'].map((token) => (
              <span
                key={token}
                className="px-4 py-2 glass rounded-lg text-xs font-medium text-gray-300 hover:text-white hover:border-primary-500/30 transition-colors"
              >
                {token}
              </span>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
