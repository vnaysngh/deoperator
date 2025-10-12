'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'

export function WalletConnect() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        // Note: If your app doesn't use authentication, you
        // can remove all 'authenticationStatus' checks
        const ready = mounted && authenticationStatus !== 'loading'
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus ||
            authenticationStatus === 'authenticated')

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-500 hover:to-primary-600 transition-all font-medium shadow-glow hover:shadow-glow-lg"
                  >
                    Connect Wallet
                  </button>
                )
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="px-6 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-500 transition-all font-medium"
                  >
                    Wrong network
                  </button>
                )
              }

              return (
                <div className="flex items-center gap-3">
                  {/* Chain Switcher */}
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="px-3 py-2 glass rounded-xl text-sm hover:bg-white/5 transition-all border border-white/10 flex items-center gap-2"
                  >
                    {chain.hasIcon && (
                      <div
                        style={{
                          background: chain.iconBackground,
                          width: 16,
                          height: 16,
                          borderRadius: 999,
                          overflow: 'hidden',
                        }}
                      >
                        {chain.iconUrl && (
                          <img
                            alt={chain.name ?? 'Chain icon'}
                            src={chain.iconUrl}
                            style={{ width: 16, height: 16 }}
                          />
                        )}
                      </div>
                    )}
                    <span className="text-gray-300">{chain.name}</span>
                  </button>

                  {/* Account Info & Disconnect */}
                  <button
                    onClick={openAccountModal}
                    type="button"
                    className="px-4 py-2 glass rounded-xl text-sm font-mono text-gray-300 border border-emerald-500/30 hover:bg-white/5 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      {account.displayName}
                    </div>
                  </button>
                </div>
              )
            })()}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
