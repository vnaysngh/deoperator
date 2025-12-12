"use client";

import { useEffect, useState } from "react";
import { useAccount, useBalance, usePublicClient, useWalletClient } from "wagmi";
import type { Address } from "viem";
import { formatUnits, parseUnits } from "viem";
import {
  getCowProtocolAllowance,
  approveCowProtocol
} from "@/lib/cowswap-client";
import { NATIVE_CURRENCY_ADDRESS } from "@/lib/native-currencies";
import { ensureClientsOnChain, describeSwitchError } from "./utils";

type CreateOrderButtonProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokenInfo: any;
  postSwapOrderFromQuote: () => Promise<string>;
  onOrderStatusChange?: (inProgress: boolean) => void;
  onOrderCompleted?: () => void;
  isLatestQuote?: boolean;
};

/**
 * Button that calls postSwapOrderFromQuote to submit the order
 * Includes balance checking, approval flow, and proper error handling
 */
export function CreateOrderButton({
  tokenInfo,
  postSwapOrderFromQuote,
  onOrderStatusChange,
  onOrderCompleted,
  isLatestQuote = true
}: CreateOrderButtonProps) {
  const [orderStatus, setOrderStatus] = useState<
    | "idle"
    | "checking-approval"
    | "approving"
    | "creating"
    | "signing"
    | "submitting"
    | "success"
    | "error"
  >("idle");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [isCheckingApproval, setIsCheckingApproval] = useState(true);

  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const isNativeCurrencyTrade =
    tokenInfo.isNativeCurrency ||
    (typeof tokenInfo.fromTokenAddress === "string" &&
      tokenInfo.fromTokenAddress.toLowerCase() ===
        NATIVE_CURRENCY_ADDRESS.toLowerCase());

  const walletChainId = walletClient?.chain?.id;
  const expectedChainLabel = tokenInfo.chain ?? `chain ID ${tokenInfo.chainId}`;
  const chainMismatch =
    walletChainId !== undefined && walletChainId !== tokenInfo.chainId;

  // Get balance for the sell token
  const { data: balance, isLoading: balanceLoading } = useBalance({
    address: address,
    token: isNativeCurrencyTrade
      ? undefined
      : (tokenInfo.fromTokenAddress as Address),
    chainId: tokenInfo.chainId
  });

  // Calculate required amount in smallest unit
  const requiredAmount = parseUnits(
    tokenInfo.amount.toString(),
    tokenInfo.fromTokenDecimals
  );
  const hasEnoughBalance = balance ? balance.value >= requiredAmount : false;

  // Check approval status on mount
  useEffect(() => {
    async function checkApproval() {
      if (chainMismatch) {
        setIsApproved(false);
        setIsCheckingApproval(false);
        return;
      }

      if (!publicClient || !walletClient || !address) {
        setIsCheckingApproval(false);
        return;
      }

      if (isNativeCurrencyTrade) {
        setIsApproved(true);
        setIsCheckingApproval(false);
        return;
      }

      try {
        const isMegaEth = tokenInfo.chainId === 6342;

        if (isMegaEth) {
          // Use GTE SDK for MegaETH
          const { getGteAllowance } = await import("@/lib/gte-swap-client");
          const allowance = await getGteAllowance({
            tokenAddress: tokenInfo.fromTokenAddress as Address,
            userAddress: address,
            publicClient
          });
          setIsApproved(allowance >= requiredAmount);
        } else {
          // Use CoW Protocol for other chains
          const allowance = await getCowProtocolAllowance(
            publicClient,
            walletClient,
            {
              tokenAddress: tokenInfo.fromTokenAddress as Address,
              owner: address,
              chainId: tokenInfo.chainId
            }
          );
          setIsApproved(allowance >= requiredAmount);
        }

        setIsCheckingApproval(false);
      } catch (err) {
        console.error("[CLIENT] Error checking approval:", err);
        setIsCheckingApproval(false);
      }
    }

    checkApproval();
  }, [
    chainMismatch,
    publicClient,
    walletClient,
    address,
    tokenInfo.fromTokenAddress,
    tokenInfo.chainId,
    requiredAmount,
    isNativeCurrencyTrade
  ]);

  useEffect(() => {
    if (!chainMismatch && orderStatus === "error" && !errorMessage) {
      setOrderStatus("idle");
    }
  }, [chainMismatch, errorMessage, orderStatus]);

  const handleClick = async () => {
    if (!address) {
      setErrorMessage("Please connect your wallet");
      setOrderStatus("error");
      return;
    }

    setErrorMessage(null);
    setOrderStatus("checking-approval");
    setIsCheckingApproval(true);
    onOrderStatusChange?.(true);

    let activePublicClient;
    let activeWalletClient;

    try {
      const clients = await ensureClientsOnChain({
        targetChainId: tokenInfo.chainId,
        address,
        publicClient,
        walletClient
      });

      activePublicClient = clients.publicClient;
      activeWalletClient = clients.walletClient;
    } catch (err) {
      console.error("[CLIENT] Failed to prepare clients for order:", err);
      const { message } = describeSwitchError(err, expectedChainLabel);
      setErrorMessage(message);
      setOrderStatus("error");
      setIsCheckingApproval(false);
      onOrderStatusChange?.(false);
      return;
    }

    try {
      const isMegaEth = tokenInfo.chainId === 6342;

      if (!isNativeCurrencyTrade) {
        let allowance: bigint;

        if (isMegaEth) {
          // Use GTE SDK for MegaETH
          const { getGteAllowance } = await import("@/lib/gte-swap-client");
          allowance = await getGteAllowance({
            tokenAddress: tokenInfo.fromTokenAddress as Address,
            userAddress: address,
            publicClient: activePublicClient
          });
        } else {
          // Use CoW Protocol for other chains
          allowance = await getCowProtocolAllowance(
            activePublicClient,
            activeWalletClient,
            {
              tokenAddress: tokenInfo.fromTokenAddress as Address,
              owner: address,
              chainId: tokenInfo.chainId
            }
          );
        }

        if (allowance < requiredAmount) {
          setOrderStatus("approving");

          if (isMegaEth) {
            // Use GTE SDK for approval
            const { approveGte } = await import("@/lib/gte-swap-client");
            await approveGte({
              tokenAddress: tokenInfo.fromTokenAddress as Address,
              userAddress: address,
              amount: requiredAmount,
              publicClient: activePublicClient,
              walletClient: activeWalletClient
            });
          } else {
            // Use CoW Protocol for approval
            await approveCowProtocol(activePublicClient, activeWalletClient, {
              tokenAddress: tokenInfo.fromTokenAddress as Address,
              amount: requiredAmount,
              chainId: tokenInfo.chainId
            });
          }
        }

        setIsApproved(true);
      } else {
        setIsApproved(true);
      }

      setIsCheckingApproval(false);

      // Step 2: Create and submit the order
      setOrderStatus("creating");
      console.log("[CLIENT] Calling postSwapOrderFromQuote...");

      setOrderStatus("signing");
      const orderResult = await postSwapOrderFromQuote();

      setOrderStatus("submitting");

      // Extract orderId - it can be a string or an object
      const extractedOrderId =
        typeof orderResult === "string"
          ? orderResult
          : (orderResult as { orderId?: string })?.orderId ||
            String(orderResult);

      console.log("[CLIENT] Order submitted!", extractedOrderId);

      setOrderId(extractedOrderId);
      setOrderStatus("success");

      // Notify parent that order is complete and successful
      onOrderStatusChange?.(false);
      onOrderCompleted?.(); // Stop timer permanently
    } catch (err) {
      console.error("[CLIENT] Order submission error:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to submit order"
      );
      setOrderStatus("error");
      onOrderStatusChange?.(false);
    } finally {
      setIsCheckingApproval(false);
    }
  };

  if (orderStatus === "success") {
    const isMegaEth = tokenInfo.chainId === 6342;

    return (
      <div className="space-y-2">
        <div className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-md">
          {isMegaEth ? (
            <>✓ Swap submitted successfully! Your transaction has been sent to the network.</>
          ) : (
            <>✓ Order submitted successfully! Your swap will be executed in the next batch auction.</>
          )}
        </div>
        {orderId && (
          <a
            href={
              isMegaEth
                ? `https://megaeth-testnet.blockscout.com/tx/${orderId}`
                : `https://explorer.cow.fi/orders/${orderId}?chainId=${tokenInfo.chainId}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-primary-400 hover:text-primary-300"
          >
            {isMegaEth ? "View transaction →" : "View order details →"}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Balance Display */}
      {balance && (
        <div className="text-xs text-gray-400">
          Balance:{" "}
          {parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(6)}{" "}
          {tokenInfo.fromToken}
        </div>
      )}

      {/* Approval Status */}
      {!isApproved &&
        hasEnoughBalance &&
        !balanceLoading &&
        !isCheckingApproval && (
          <div className="text-xs text-yellow-400 bg-yellow-500/10 px-3 py-2 rounded-md">
            ⚠️ Token approval required. You&apos;ll be asked to approve{" "}
            {tokenInfo.fromToken} before creating the order.
          </div>
        )}

      {/* Error Messages */}
      {!hasEnoughBalance && !balanceLoading && balance && (
        <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-md">
          Insufficient {tokenInfo.fromToken} balance. You need{" "}
          {tokenInfo.amount} {tokenInfo.fromToken} but only have{" "}
          {parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(6)}{" "}
          {tokenInfo.fromToken}.
        </div>
      )}

      {orderStatus === "error" && errorMessage && (
        <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-md">
          {errorMessage}
        </div>
      )}

      {/* Create Order Button */}
      <button
        onClick={handleClick}
        disabled={
          !isLatestQuote ||
          !address ||
          (orderStatus !== "idle" && orderStatus !== "error") ||
          !hasEnoughBalance ||
          balanceLoading ||
          isCheckingApproval
        }
        className={`w-full px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
          !isLatestQuote
            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
            : !address ||
              !hasEnoughBalance ||
              balanceLoading ||
              isCheckingApproval
            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
            : orderStatus !== "idle" && orderStatus !== "error"
            ? "bg-emerald-600 text-white cursor-wait"
            : "bg-emerald-600 hover:bg-emerald-500 text-white"
        }`}
      >
        {!isLatestQuote ? (
          "Expired"
        ) : balanceLoading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Checking balance...
          </span>
        ) : isCheckingApproval ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Checking approval...
          </span>
        ) : orderStatus === "checking-approval" ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Checking approval...
          </span>
        ) : orderStatus === "approving" ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Approve in wallet...
          </span>
        ) : orderStatus === "creating" ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Preparing order...
          </span>
        ) : orderStatus === "signing" ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Sign in wallet...
          </span>
        ) : orderStatus === "submitting" ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Submitting order...
          </span>
        ) : orderStatus === "error" ? (
          "Try Again"
        ) : !hasEnoughBalance ? (
          "Insufficient Balance"
        ) : !isApproved ? (
          "Approve & Create Order"
        ) : (
          "Create Order"
        )}
      </button>
    </div>
  );
}
