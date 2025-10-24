"use client";

import { useMemo, useState } from "react";
import { useBalance } from "wagmi";
import type { Address } from "viem";
import { formatUnits, parseUnits } from "viem";
import {
  approveMorphoVault,
  depositIntoMorphoVault,
  getMorphoVaultAllowance
} from "@/lib/morpho-client";
import { formatCompactNumber } from "@/lib/utils";
import { ensureClientsOnChain, describeSwitchError } from "./utils";

export type MorphoStakingOption = {
  needsClientStaking: true;
  chainId: number;
  chainLabel: string;
  tokenSymbol: string;
  vaultAddress: Address;
  vaultName?: string;
  vaultSymbol?: string;
  assetAddress: Address;
  assetDecimals: number;
  apy: number | null;
  netApy: number | null;
  tvlUsd: number | null;
  totalAssets: string | null;
};

type MorphoStakingCardProps = {
  stakingInfo: MorphoStakingOption;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletClient: any;
  address?: Address;
};

export function MorphoStakingCard({
  stakingInfo,
  publicClient,
  walletClient,
  address
}: MorphoStakingCardProps) {
  const [amount, setAmount] = useState("");
  const [actionState, setActionState] = useState<
    "idle" | "checking-allowance" | "approval" | "staking" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  const walletChainId = walletClient?.chain?.id;
  const chainMismatch =
    walletChainId !== undefined && walletChainId !== stakingInfo.chainId;

  const explorerBaseUrl = useMemo(() => {
    switch (stakingInfo.chainId) {
      case 1:
        return "https://etherscan.io/tx/";
      case 42161:
        return "https://arbiscan.io/tx/";
      case 8453:
        return "https://basescan.org/tx/";
      default:
        return null;
    }
  }, [stakingInfo.chainId]);

  const {
    data: balance,
    isLoading: balanceLoading,
    refetch
  } = useBalance({
    address,
    chainId: stakingInfo.chainId,
    token: stakingInfo.assetAddress
  });

  const apyDisplay =
    stakingInfo.netApy !== null && stakingInfo.netApy !== undefined
      ? (stakingInfo.netApy * 100).toFixed(2)
      : stakingInfo.apy !== null && stakingInfo.apy !== undefined
      ? (stakingInfo.apy * 100).toFixed(2)
      : null;

  const totalAssetsNumber =
    stakingInfo.totalAssets && stakingInfo.assetDecimals !== undefined
      ? Number.parseFloat(
          formatUnits(
            BigInt(stakingInfo.totalAssets),
            stakingInfo.assetDecimals
          )
        )
      : null;

  const totalAssetsCompact =
    totalAssetsNumber !== null && Number.isFinite(totalAssetsNumber)
      ? formatCompactNumber(totalAssetsNumber, { fullDigits: 2 })
      : null;

  const tvlCompact =
    stakingInfo.tvlUsd !== null && stakingInfo.tvlUsd !== undefined
      ? formatCompactNumber(stakingInfo.tvlUsd, { fullDigits: 0 })
      : null;

  const balanceDisplay = balance
    ? `${parseFloat(balance.formatted).toLocaleString(undefined, {
        maximumFractionDigits:
          stakingInfo.assetDecimals > 6 ? 6 : stakingInfo.assetDecimals
      })} ${stakingInfo.tokenSymbol}`
    : `0 ${stakingInfo.tokenSymbol}`;

  const parsedAmount = (() => {
    if (!amount) return null;
    try {
      return parseUnits(amount, stakingInfo.assetDecimals);
    } catch {
      return null;
    }
  })();

  const isAmountValid =
    parsedAmount !== null &&
    parsedAmount > BigInt(0) &&
    !Number.isNaN(Number(amount));
  const hasSufficientBalance =
    parsedAmount !== null && balance ? balance.value >= parsedAmount : false;

  const stakeDisabled =
    !address ||
    !isAmountValid ||
    !hasSufficientBalance ||
    balanceLoading ||
    actionState === "checking-allowance" ||
    actionState === "approval" ||
    actionState === "staking";

  const liquidityLabel = (() => {
    if (totalAssetsCompact && tvlCompact) {
      return `≈${totalAssetsCompact.short} ${stakingInfo.tokenSymbol} ($${tvlCompact.short})`;
    }
    if (totalAssetsCompact) {
      return `≈${totalAssetsCompact.short} ${stakingInfo.tokenSymbol}`;
    }
    if (tvlCompact) {
      return `≈$${tvlCompact.short}`;
    }
    return "Unknown";
  })();

  const liquidityTitle = (() => {
    if (totalAssetsCompact && tvlCompact) {
      return `${totalAssetsCompact.full} ${stakingInfo.tokenSymbol} • $${tvlCompact.full}`;
    }
    if (totalAssetsCompact) {
      return `${totalAssetsCompact.full} ${stakingInfo.tokenSymbol}`;
    }
    if (tvlCompact) {
      return `$${tvlCompact.full}`;
    }
    return "Liquidity unavailable";
  })();

  const handleMax = () => {
    if (balance) {
      setAmount(balance.formatted);
    }
  };

  const handleStake = async () => {
    setErrorMessage(null);
    setTransactionHash(null);

    if (!address) {
      setErrorMessage("Connect your wallet to proceed.");
      return;
    }

    if (!parsedAmount || parsedAmount <= BigInt(0)) {
      setErrorMessage("Enter a valid amount to stake.");
      return;
    }

    if (!hasSufficientBalance) {
      setErrorMessage(
        `You don't have enough ${stakingInfo.tokenSymbol} to stake that amount.`
      );
      return;
    }

    setActionState("checking-allowance");

    let activePublicClient;
    let activeWalletClient;

    try {
      const clients = await ensureClientsOnChain({
        targetChainId: stakingInfo.chainId,
        address,
        publicClient,
        walletClient
      });

      activePublicClient = clients.publicClient;
      activeWalletClient = clients.walletClient;
    } catch (err) {
      console.error("[CLIENT] Morpho staking network preparation error:", err);
      const { message } = describeSwitchError(err, stakingInfo.chainLabel);
      setActionState("error");
      setErrorMessage(message);
      return;
    }

    try {
      await refetch?.();

      const ownerAddress = address as Address;

      const allowance = await getMorphoVaultAllowance(activePublicClient, {
        assetAddress: stakingInfo.assetAddress,
        owner: ownerAddress,
        vaultAddress: stakingInfo.vaultAddress
      });

      if (allowance < parsedAmount) {
        setActionState("approval");
        const approvalHash = await approveMorphoVault(activeWalletClient, {
          assetAddress: stakingInfo.assetAddress,
          owner: ownerAddress,
          vaultAddress: stakingInfo.vaultAddress,
          amount: parsedAmount
        });

        await activePublicClient.waitForTransactionReceipt({
          hash: approvalHash
        });
      }

      setActionState("staking");
      const stakeHash = await depositIntoMorphoVault(activeWalletClient, {
        vaultAddress: stakingInfo.vaultAddress,
        owner: ownerAddress,
        assets: parsedAmount,
        receiver: ownerAddress
      });

      setTransactionHash(stakeHash);

      await activePublicClient.waitForTransactionReceipt({
        hash: stakeHash
      });

      await refetch?.();

      setActionState("success");
      setAmount("");
      setErrorMessage(null);
    } catch (err) {
      console.error("[CLIENT] Morpho staking error:", err);
      setActionState("error");
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Something went wrong while staking."
      );
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      <div className="glass-strong rounded-lg p-4 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-primary-300">
              <span className="inline-flex h-2 w-2 rounded-full bg-primary-400"></span>
              Morpho Staking
            </div>
            <div className="text-lg font-semibold text-white mt-1">
              {stakingInfo.tokenSymbol} on {stakingInfo.chainLabel}
            </div>
            <div className="text-xs text-gray-400">
              Vault address:{" "}
              <span className="font-mono text-[11px] text-gray-300">
                {stakingInfo.vaultAddress.slice(0, 6)}…
                {stakingInfo.vaultAddress.slice(-4)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm sm:justify-end">
            <div>
              <div className="text-gray-400 text-xs uppercase">Net APY</div>
              <div className="text-white font-semibold">
                {apyDisplay ? `${apyDisplay}%` : "Unknown"}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-xs uppercase">Liquidity</div>
              <div className="text-white font-semibold">
                <span title={liquidityTitle}>{liquidityLabel}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-black/30 rounded-xl border border-white/10 p-3 space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Available balance</span>
            <span>{balanceLoading ? "Checking..." : balanceDisplay}</span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setErrorMessage(null);
                if (actionState === "success" || actionState === "error") {
                  setActionState("idle");
                }
              }}
              placeholder={`Amount of ${stakingInfo.tokenSymbol} to stake`}
              className="w-full sm:flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500/60"
            />
            <button
              type="button"
              onClick={handleMax}
              className="w-full sm:w-auto px-3 py-2 text-xs border border-white/10 rounded-lg text-gray-300 hover:bg-white/10 transition-colors"
              disabled={!balance || balance.value === BigInt(0)}
            >
              Max
            </button>
            <button
              type="button"
              onClick={handleStake}
              disabled={stakeDisabled}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {actionState === "checking-allowance"
                ? "Checking..."
                : actionState === "approval"
                ? "Approving..."
                : actionState === "staking"
                ? "Staking..."
                : actionState === "success"
                ? "Staked"
                : "Stake"}
            </button>
          </div>

          {chainMismatch && (
            <div className="text-xs text-amber-400">
              We&apos;ll prompt your wallet to switch to{" "}
              {stakingInfo.chainLabel} when you stake. If nothing pops up,
              change networks manually.
            </div>
          )}
          {!hasSufficientBalance && isAmountValid && !balanceLoading && (
            <div className="text-xs text-amber-400">
              Insufficient {stakingInfo.tokenSymbol} balance for this stake.
            </div>
          )}
          {!isAmountValid && amount && (
            <div className="text-xs text-amber-400">
              Enter a valid amount using numbers and decimals only.
            </div>
          )}
          {errorMessage && (
            <div className="text-xs text-red-400">{errorMessage}</div>
          )}
          {transactionHash && (
            <div className="text-xs text-emerald-400">
              Stake transaction:{" "}
              {explorerBaseUrl ? (
                <a
                  href={`${explorerBaseUrl}${transactionHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono underline-offset-2 hover:underline"
                >
                  {transactionHash.slice(0, 6)}…{transactionHash.slice(-4)}
                </a>
              ) : (
                <span className="font-mono">
                  {transactionHash.slice(0, 6)}…{transactionHash.slice(-4)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="text-[11px] text-gray-500">
          Powered by Morpho. Approvals and staking transactions will use your
          connected wallet.
        </div>
      </div>
    </div>
  );
}
