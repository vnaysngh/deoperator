"use client";

import { useBalance } from "wagmi";
import type { Address } from "viem";
import { formatUnits } from "viem";
import { NATIVE_CURRENCY_ADDRESS } from "@/lib/native-currencies";
import { QuoteDisplay } from "./QuoteDisplay";

type EntireBalanceQuoteDisplayProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokenInfo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletClient: any;
  address?: Address;
};

/**
 * Component that fetches user's entire balance and then displays quote
 * Used for "swap my whole balance" requests
 */
export function EntireBalanceQuoteDisplay({
  tokenInfo,
  publicClient,
  walletClient,
  address
}: EntireBalanceQuoteDisplayProps) {
  const isNativeCurrencyTrade =
    tokenInfo.isNativeCurrency ||
    (typeof tokenInfo.fromTokenAddress === "string" &&
      tokenInfo.fromTokenAddress.toLowerCase() ===
        NATIVE_CURRENCY_ADDRESS.toLowerCase());

  // Fetch balance using wagmi
  const { data: balance, isLoading: balanceLoading } = useBalance({
    address: address,
    token: isNativeCurrencyTrade
      ? undefined
      : (tokenInfo.fromTokenAddress as Address),
    chainId: tokenInfo.chainId
  });

  if (balanceLoading) {
    return (
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="text-xs flex items-center gap-2 text-primary-300">
          <div className="w-3 h-3 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"></div>
          <span>Checking {tokenInfo.fromToken} balance...</span>
        </div>
      </div>
    );
  }

  // Check if balance is zero or undefined
  if (!balance || balance.value === BigInt(0)) {
    return (
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="glass-strong rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <span className="text-xs font-semibold text-amber-400">Notice</span>
          </div>
          <div className="text-white text-sm">
            You don&apos;t have any {tokenInfo.fromToken} to swap on{" "}
            {tokenInfo.chain}.
          </div>
        </div>
      </div>
    );
  }

  // Convert balance to human-readable format
  const balanceAmount = formatUnits(balance.value, balance.decimals);

  // Create updated tokenInfo with the actual balance
  const updatedTokenInfo = {
    ...tokenInfo,
    amount: balanceAmount,
    needsClientBalanceFetch: false // Already fetched
  };

  // Now render the normal QuoteDisplay with the balance
  return (
    <>
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="text-sm text-gray-300">
          Your {tokenInfo.fromToken} balance:{" "}
          {parseFloat(balanceAmount).toFixed(6)} {tokenInfo.fromToken}
        </div>
      </div>
      <QuoteDisplay
        tokenInfo={updatedTokenInfo}
        publicClient={publicClient}
        walletClient={walletClient}
        address={address}
      />
    </>
  );
}
