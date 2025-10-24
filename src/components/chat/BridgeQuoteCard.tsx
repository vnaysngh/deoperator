"use client";

import { useCallback, useMemo, useState } from "react";
import { useBalance } from "wagmi";
import type { Address } from "viem";
import { formatUnits, erc20Abi, maxUint256 } from "viem";
import {
  deserializeBridgeDeposit,
  getAcrossClient,
  type SerializedBridgeQuote
} from "@/lib/across-client";
import { ensureClientsOnChain, describeSwitchError } from "./utils";

type BridgeQuoteCardProps = {
  bridgeQuote: SerializedBridgeQuote;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletClient: any;
  address?: Address;
};

function getExplorerUrl(chainId: number, txHash: string): string {
  const explorers: Record<number, string> = {
    1: "https://etherscan.io/tx/",
    42161: "https://arbiscan.io/tx/",
    8453: "https://basescan.org/tx/"
  };
  return explorers[chainId]
    ? `${explorers[chainId]}${txHash}`
    : `https://etherscan.io/tx/${txHash}`;
}

export function BridgeQuoteCard({
  bridgeQuote,
  publicClient,
  walletClient,
  address
}: BridgeQuoteCardProps) {
  const [status, setStatus] = useState<
    | "idle"
    | "preparing"
    | "approving"
    | "depositing"
    | "waiting-fill"
    | "success"
    | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [depositTxHash, setDepositTxHash] = useState<string | null>(null);

  const {
    data: balance,
    isLoading: balanceLoading,
    refetch
  } = useBalance({
    address,
    chainId: bridgeQuote.originChainId,
    token: bridgeQuote.isNative
      ? undefined
      : (bridgeQuote.tokenAddress as Address)
  });

  const inputAmount = useMemo(
    () => BigInt(bridgeQuote.inputAmountWei),
    [bridgeQuote.inputAmountWei]
  );

  const hasEnoughBalance = useMemo(() => {
    if (!balance) {
      return null;
    }
    return balance.value >= inputAmount;
  }, [balance, inputAmount]);

  const isProcessing =
    status === "preparing" ||
    status === "approving" ||
    status === "depositing" ||
    status === "waiting-fill";

  const buttonLabel = useMemo(() => {
    switch (status) {
      case "preparing":
        return "Switching...";
      case "approving":
        return "Approve in wallet...";
      case "depositing":
        return "Confirm deposit...";
      case "waiting-fill":
        return "Waiting for fill...";
      case "success":
        return "Bridge again";
      case "error":
        return "Try again";
      default:
        return "Bridge";
    }
  }, [status]);

  const feeSummary = useMemo(() => {
    const formatPercent = (value: number) =>
      Number.isFinite(value) ? `${value.toFixed(3)}%` : "—";

    return {
      netFee: {
        label: "Net fee",
        value: `${bridgeQuote.totalFee?.amountFormatted ?? "—"} ${
          bridgeQuote.tokenSymbol
        }`,
        percent: formatPercent(bridgeQuote.totalFee?.percentage ?? 0),
        breakdown: {
          networkFee: bridgeQuote.relayerGasFee?.amountFormatted
            ? `${bridgeQuote.relayerGasFee.amountFormatted} ${bridgeQuote.tokenSymbol}`
            : "—",
          relayerFee: bridgeQuote.relayerCapitalFee?.amountFormatted
            ? `${bridgeQuote.relayerCapitalFee.amountFormatted} ${bridgeQuote.tokenSymbol}`
            : "—"
        }
      },
      eta: {
        label: "ETA",
        value: bridgeQuote.estimatedFillTimeFormatted ?? "—"
      }
    };
  }, [bridgeQuote]);

  const handleBridge = useCallback(async () => {
    if (!address) {
      setErrorMessage("Connect your wallet to bridge.");
      return;
    }

    if (hasEnoughBalance === false) {
      setErrorMessage(
        `You don't have enough ${bridgeQuote.tokenSymbol} on ${bridgeQuote.originChainLabel} to bridge that amount.`
      );
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setDepositTxHash(null);

    let preparedClients: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      publicClient: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      walletClient: any;
    };

    try {
      setStatus("preparing");
      setStatusMessage(`Switching to ${bridgeQuote.originChainLabel}...`);
      preparedClients = await ensureClientsOnChain({
        targetChainId: bridgeQuote.originChainId,
        address,
        publicClient,
        walletClient
      });
      await refetch?.();
    } catch (switchError) {
      const { message } = describeSwitchError(
        switchError,
        bridgeQuote.originChainLabel
      );
      setStatus("error");
      setStatusMessage(null);
      setErrorMessage(message);
      return;
    }

    try {
      const acrossClient = getAcrossClient();
      acrossClient.update({
        walletClient: preparedClients.walletClient
      });

      const deposit = deserializeBridgeDeposit(bridgeQuote.deposit);
      const destinationClient = acrossClient.getPublicClient(
        bridgeQuote.destinationChainId
      );

      // Manual approval handling for ERC20 tokens (especially for max balance)
      if (!bridgeQuote.isNative) {
        setStatus("approving");
        setStatusMessage("Checking token allowance...");

        try {
          // Check current allowance
          const allowance = await preparedClients.publicClient.readContract({
            address: bridgeQuote.tokenAddress,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, deposit.spokePoolAddress]
          });

          const requiredAmount = BigInt(bridgeQuote.inputAmountWei);

          // If allowance is insufficient, approve max to avoid future approvals
          if (allowance < requiredAmount) {
            setStatusMessage("Approving token spend...");

            const { request } =
              await preparedClients.publicClient.simulateContract({
                address: bridgeQuote.tokenAddress,
                abi: erc20Abi,
                functionName: "approve",
                args: [deposit.spokePoolAddress, maxUint256],
                account: address
              });

            const hash = await preparedClients.walletClient.writeContract(
              request
            );
            setStatusMessage("Waiting for approval confirmation...");

            await preparedClients.publicClient.waitForTransactionReceipt({
              hash
            });
            setStatusMessage("Approval confirmed. Preparing bridge...");
          }
        } catch (approvalError) {
          console.error("[CLIENT] Approval error:", approvalError);
          if (
            approvalError instanceof Error &&
            approvalError.message.toLowerCase().includes("user rejected")
          ) {
            setStatus("error");
            setStatusMessage(null);
            setErrorMessage(
              "Token approval was rejected. Please approve to continue."
            );
            return;
          }
          // Continue anyway, let SDK handle it
          console.log("[CLIENT] Continuing with SDK approval handling");
        }
      }

      setStatus("depositing");
      setStatusMessage("Preparing bridge transaction...");

      // Suppress RPC filter errors (SDK has fallback mechanism)
      const originalError = console.error;
      console.error = (...args: unknown[]) => {
        const message = String(args[0] || "");
        if (
          message.includes("filter not found") ||
          message.includes("Watch FilledRelay event error") ||
          message.includes("Error waiting for fill events") ||
          message.includes("Event filtering currently disabled")
        ) {
          return; // Suppress these specific errors
        }
        originalError.apply(console, args);
      };

      try {
        await acrossClient.executeQuote({
          deposit,
          walletClient: preparedClients.walletClient,
          originClient: preparedClients.publicClient,
          destinationClient,
          onProgress: (progress) => {
            if (
              progress.status === "error" ||
              progress.status === "simulationError" ||
              progress.status === "txError"
            ) {
              setStatus("error");
              setStatusMessage(null);
              setErrorMessage(
                progress.error?.message ||
                  "Bridge transaction failed. Please try again."
              );
              return;
            }

            if (progress.step === "approve") {
              if (progress.status === "txPending") {
                setStatus("approving");
                setStatusMessage("Approval pending in your wallet...");
              }
              if (progress.status === "txSuccess") {
                setStatusMessage("Approval confirmed. Preparing deposit...");
              }
            }

            if (progress.step === "deposit") {
              if (progress.status === "simulationPending") {
                setStatus("depositing");
                setStatusMessage("Simulating deposit...");
              }
              if (progress.status === "txPending") {
                setStatus("depositing");
                setStatusMessage(
                  "Deposit submitted. Waiting for confirmation..."
                );
                if (progress.txHash) {
                  setDepositTxHash(progress.txHash);
                }
              }
              if (progress.status === "txSuccess") {
                setStatus("waiting-fill");
                setStatusMessage(
                  "Deposit confirmed! Waiting for the relayer to fill on the destination chain..."
                );
                if (progress.txReceipt?.transactionHash) {
                  setDepositTxHash(progress.txReceipt.transactionHash);
                }
              }
            }

            if (progress.step === "fill") {
              if (progress.status === "txPending") {
                setStatus("waiting-fill");
                setStatusMessage(
                  "Fill transaction pending on the destination chain..."
                );
              }
              if (progress.status === "txSuccess") {
                setStatus("success");
                setStatusMessage(
                  "Bridge filled! Funds are available on the destination chain."
                );
              }
            }
          }
        });
      } finally {
        // Restore original console.error
        console.error = originalError;
      }
    } catch (err) {
      console.error("[CLIENT] Across bridge error:", err);
      setStatus("error");
      setStatusMessage(null);

      if (err instanceof Error) {
        const lower = err.message.toLowerCase();
        if (lower.includes("user rejected")) {
          setErrorMessage(
            "Looks like the transaction was rejected. Approve it in your wallet to bridge."
          );
          return;
        }
        setErrorMessage(err.message);
        return;
      }

      setErrorMessage("Bridge failed. Please try again.");
    }
  }, [
    address,
    bridgeQuote,
    publicClient,
    walletClient,
    hasEnoughBalance,
    refetch
  ]);

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      <div className="glass-strong rounded-lg p-4 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-primary-300">
              <span className="inline-flex h-2 w-2 rounded-full bg-primary-400"></span>
              Across Bridge
            </div>
            <div className="text-lg font-semibold text-white mt-1">
              {bridgeQuote.requestedAmount} {bridgeQuote.tokenSymbol}
            </div>
            <div className="text-xs text-gray-400">
              {bridgeQuote.originChainLabel} →{" "}
              {bridgeQuote.destinationChainLabel}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm sm:justify-end">
            <div>
              <div className="text-gray-400 text-xs uppercase">You send</div>
              <div className="text-white font-semibold">
                {bridgeQuote.inputAmountFormatted} {bridgeQuote.tokenSymbol}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-xs uppercase">You receive</div>
              <div className="text-white font-semibold">
                {bridgeQuote.outputAmountFormatted} {bridgeQuote.tokenSymbol}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-black/30 rounded-xl border border-white/10 p-3 space-y-3">
          <div className="text-xs text-gray-300 font-medium">Fee breakdown</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 flex items-center gap-1">
                {feeSummary.netFee.label}
                <span className="relative inline-flex isolate">
                  <svg
                    className="w-3 h-3 text-gray-500 hover:text-gray-300 transition-colors cursor-help peer"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 invisible peer-hover:opacity-100 peer-hover:visible transition-opacity w-48 bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg p-3 z-10 pointer-events-none">
                    <div className="text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Network fee:</span>
                        <span className="text-gray-200">
                          {feeSummary.netFee.breakdown.networkFee}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Relayer fee:</span>
                        <span className="text-gray-200">
                          {feeSummary.netFee.breakdown.relayerFee}
                        </span>
                      </div>
                    </div>
                  </div>
                </span>
              </span>
              <span className="text-gray-200">
                {feeSummary.netFee.value}
                <span className="text-gray-500">
                  {" "}
                  ({feeSummary.netFee.percent})
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">{feeSummary.eta.label}</span>
              <span className="text-gray-200">{feeSummary.eta.value}</span>
            </div>
          </div>
          {hasEnoughBalance === false && (
            <div className="text-xs text-red-400">
              Insufficient {bridgeQuote.tokenSymbol} balance. You need{" "}
              {bridgeQuote.inputAmountFormatted} {bridgeQuote.tokenSymbol} but
              only have{" "}
              {balance
                ? `${Number(
                    formatUnits(balance.value, balance.decimals)
                  ).toLocaleString(undefined, {
                    maximumFractionDigits: 6
                  })} ${bridgeQuote.tokenSymbol}`
                : `0 ${bridgeQuote.tokenSymbol}`}
              .
            </div>
          )}
          {bridgeQuote.isAmountTooLow && hasEnoughBalance !== false && (
            <div className="text-xs text-amber-400">
              This amount is near the minimum. Larger deposits may settle
              faster.
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleBridge}
            disabled={
              !address ||
              isProcessing ||
              balanceLoading ||
              hasEnoughBalance === false
            }
            className="w-full px-4 py-3 rounded-lg font-semibold text-sm transition-all bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
          >
            {buttonLabel}
          </button>
          {balanceLoading && (
            <div className="text-xs text-primary-300">Checking balance...</div>
          )}
          {statusMessage && (
            <div className="text-xs text-primary-300">{statusMessage}</div>
          )}
          {errorMessage && (
            <div className="text-xs text-red-400">{errorMessage}</div>
          )}
          {status === "success" && depositTxHash && (
            <a
              href={getExplorerUrl(bridgeQuote.originChainId, depositTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
            >
              View transaction on explorer →
            </a>
          )}
          {status === "waiting-fill" && depositTxHash && (
            <a
              href={getExplorerUrl(bridgeQuote.originChainId, depositTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-primary-400 hover:text-primary-300 underline underline-offset-2"
            >
              Track bridge status on explorer →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
