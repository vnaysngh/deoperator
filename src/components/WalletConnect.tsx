"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useAccount, useDisconnect, useEnsName, useSwitchChain } from "wagmi";
import { openAppKitModal } from "./Providers";

function truncateAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function useOutsideClick<T extends HTMLElement>(
  ref: RefObject<T>,
  handler: () => void
) {
  useEffect(() => {
    function listener(event: MouseEvent) {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler();
    }
    window.addEventListener("mousedown", listener);
    return () => window.removeEventListener("mousedown", listener);
  }, [ref, handler]);
}

export function WalletConnect() {
  const { address, status, chainId } = useAccount();
  console.log(address, status, chainId, "wallet config");
  const { chains, switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { disconnectAsync, isPending: isDisconnecting } = useDisconnect();
  const { data: ensName } = useEnsName({
    address,
    chainId: 1,
    query: { enabled: Boolean(address) }
  });

  const [isChainMenuOpen, setChainMenuOpen] = useState(false);
  const [isAccountMenuOpen, setAccountMenuOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  const chainMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useOutsideClick(chainMenuRef as RefObject<HTMLElement>, () =>
    setChainMenuOpen(false)
  );
  useOutsideClick(accountMenuRef as RefObject<HTMLElement>, () =>
    setAccountMenuOpen(false)
  );

  const currentChain = useMemo(
    () => chains.find((network) => network.id === chainId),
    [chains, chainId]
  );

  const handleSwitchChain = useCallback(
    async (targetChainId: number) => {
      if (isSwitching || targetChainId === chainId) {
        setChainMenuOpen(false);
        return;
      }
      try {
        await switchChainAsync({ chainId: targetChainId });
      } catch (error) {
        console.error("[WalletConnect] Failed to switch chain", error);
      } finally {
        setChainMenuOpen(false);
      }
    },
    [chainId, isSwitching, switchChainAsync]
  );

  const handleDisconnect = useCallback(async () => {
    if (isDisconnecting) return;
    try {
      await disconnectAsync();
    } catch (error) {
      console.error("[WalletConnect] Failed to disconnect", error);
    } finally {
      setAccountMenuOpen(false);
    }
  }, [disconnectAsync, isDisconnecting]);

  const handleCopy = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 1500);
    } catch (error) {
      console.error("[WalletConnect] Failed to copy address", error);
    }
  }, [address]);

  const isConnected = Boolean(address) && status !== "disconnected";

  if (!isConnected) {
    return (
      <button
        onClick={openAppKitModal}
        type="button"
        className="px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-500 hover:to-primary-600 transition-all font-medium shadow-glow hover:shadow-glow-lg text-sm sm:text-base"
      >
        <span className="hidden sm:inline">Connect Wallet</span>
        <span className="sm:hidden">Connect</span>
      </button>
    );
  }

  return (
    <div className="relative flex items-center gap-2 sm:gap-3">
      <div ref={chainMenuRef} className="relative">
        <button
          onClick={() => {
            setChainMenuOpen((open) => !open);
            setAccountMenuOpen(false);
          }}
          type="button"
          className="px-2 sm:px-3 py-1.5 sm:py-2 glass rounded-xl text-xs sm:text-sm hover:bg-white/5 transition-all border border-white/10 flex items-center gap-1.5 sm:gap-2 cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
          {/*  <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-semibold text-white/80">
            {chainInitials}
          </span> */}
          <span className="text-gray-300 truncate max-w-[80px] sm:max-w-none">
            {currentChain?.name ?? "Chain"}
          </span>
        </button>

        {isChainMenuOpen && (
          <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-zinc-950/90 backdrop-blur-lg shadow-xl shadow-black/40 z-50">
            <div className="px-3 py-2 border-b border-white/5 text-xs uppercase tracking-wide text-gray-500">
              Switch Network
            </div>
            <ul className="py-1 text-sm">
              {chains.map((network) => (
                <li key={network.id}>
                  <button
                    onClick={() => handleSwitchChain(network.id)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 hover:bg-white/10 transition-colors ${
                      network.id === chainId ? "bg-primary-500/10" : ""
                    }`}
                  >
                    <span className="flex flex-col">
                      <span className="text-gray-100">{network.name}</span>
                      {/*  <span className="text-[11px] uppercase text-gray-500">
                        Chain ID {network.id}
                      </span> */}
                    </span>
                    {network.id === chainId && (
                      <span className="text-emerald-400 text-xs font-semibold">
                        Active
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {isSwitching && (
              <div className="px-3 py-2 text-[11px] text-primary-300 border-t border-white/5">
                Switching network…
              </div>
            )}
          </div>
        )}
      </div>

      <div ref={accountMenuRef} className="relative">
        <button
          onClick={() => {
            setAccountMenuOpen((open) => !open);
            setChainMenuOpen(false);
          }}
          type="button"
          className="px-3 sm:px-4 py-1.5 sm:py-2 glass rounded-xl text-xs sm:text-sm font-mono text-gray-300 border border-emerald-500/30 hover:bg-white/5 transition-all cursor-pointer"
        >
          {ensName ?? truncateAddress(address)}
        </button>

        {isAccountMenuOpen && (
          <div className="absolute right-0 mt-2 w-60 rounded-xl border border-white/10 bg-zinc-950/90 backdrop-blur-lg shadow-xl shadow-black/40 z-50">
            <div className="px-4 py-3 border-b border-white/5">
              <div className="text-xs uppercase tracking-wide text-gray-500">
                Wallet
              </div>
              <div className="text-sm font-mono text-gray-200">
                {truncateAddress(address)}
              </div>
            </div>

            <button
              onClick={handleCopy}
              className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors text-sm flex items-center justify-between text-gray-200"
            >
              <span>Copy address</span>
              <span className="text-xs text-primary-300">
                {copyStatus === "copied" && "Copied!"}
              </span>
            </button>

            {currentChain?.blockExplorers?.default.url && address && (
              <a
                href={`${currentChain.blockExplorers.default.url}/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-3 hover:bg-white/10 transition-colors text-sm text-gray-200"
              >
                View on {currentChain.blockExplorers.default.name}
              </a>
            )}

            <div className="border-t border-white/5">
              <button
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="w-full text-left px-4 py-3 text-sm text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isDisconnecting ? "Disconnecting…" : "Disconnect wallet"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
