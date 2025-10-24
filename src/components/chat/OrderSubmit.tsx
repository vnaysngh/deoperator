"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { quoteAndSubmitSwap } from "@/lib/cowswap-client";

type OrderSubmitProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokenInfo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletClient: any;
  address?: Address;
};

/**
 * Component that submits order using client-side Trading SDK
 */
export function OrderSubmit({
  tokenInfo,
  publicClient,
  walletClient,
  address
}: OrderSubmitProps) {
  const [status, setStatus] = useState<"submitting" | "success" | "error">(
    "submitting"
  );
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function submitOrder() {
      if (!address) {
        setError("Please connect your wallet");
        setStatus("error");
        return;
      }

      const expectedChainLabel =
        tokenInfo.chain ?? `chain ID ${tokenInfo.chainId}`;

      let activePublicClient = publicClient;
      if (
        !activePublicClient ||
        (activePublicClient.chain &&
          activePublicClient.chain.id !== tokenInfo.chainId)
      ) {
        try {
          const { getPublicClient } = await import("wagmi/actions");
          const { wagmiAdapter } = await import("@/lib/wagmi");
          activePublicClient = await getPublicClient(wagmiAdapter.wagmiConfig, {
            chainId: tokenInfo.chainId
          });
        } catch (publicClientError) {
          console.error(
            "[CLIENT] Unable to resolve public client:",
            publicClientError
          );
        }
      }

      if (!activePublicClient) {
        setError(
          "Unable to reach the selected network. Please try again after reconnecting."
        );
        setStatus("error");
        return;
      }

      let activeWalletClient = walletClient;

      if (!activeWalletClient) {
        try {
          const { getWalletClient } = await import("wagmi/actions");
          const { wagmiAdapter } = await import("@/lib/wagmi");
          activeWalletClient = await getWalletClient(wagmiAdapter.wagmiConfig, {
            account: address,
            chainId: tokenInfo.chainId
          });
        } catch (walletClientError) {
          console.error(
            "[CLIENT] Unable to resolve wallet client for order submission:",
            walletClientError
          );
          setError(
            `Switch your wallet to ${expectedChainLabel} before submitting the order.`
          );
          setStatus("error");
          return;
        }
      }

      if (
        activeWalletClient.chain &&
        activeWalletClient.chain.id !== tokenInfo.chainId
      ) {
        setError(
          `Switch your wallet to ${expectedChainLabel} before submitting the order.`
        );
        setStatus("error");
        return;
      }

      try {
        console.log("[CLIENT] Submitting order with Trading SDK...");

        const result = await quoteAndSubmitSwap(
          activePublicClient,
          activeWalletClient,
          {
            sellToken: tokenInfo.fromTokenAddress as Address,
            sellTokenDecimals: tokenInfo.fromTokenDecimals,
            buyToken: tokenInfo.toTokenAddress as Address,
            buyTokenDecimals: tokenInfo.toTokenDecimals,
            amount: tokenInfo.sellAmount,
            userAddress: address,
            chainId: tokenInfo.chainId
          }
        );

        setOrderId(result.orderId);
        setStatus("success");
      } catch (err) {
        console.error("[CLIENT] Order submission error:", err);
        setError(err instanceof Error ? err.message : "Failed to submit order");
        setStatus("error");
      }
    }

    submitOrder();
  }, [tokenInfo, publicClient, walletClient, address]);

  if (status === "submitting") {
    return (
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="glass-strong rounded-lg p-4">
          <div className="flex items-center gap-2 text-primary-300">
            <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Submitting order via Trading SDK...</span>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="glass-strong rounded-lg p-4">
          <div className="text-red-400">
            {error || "Failed to submit order"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      <div className="glass-strong rounded-lg p-4">
        <div className="text-emerald-400 font-semibold mb-2">
          ✓ Order Submitted!
        </div>
        <div className="text-sm text-gray-300 mb-2">
          Order ID: <span className="font-mono text-xs">{orderId}</span>
        </div>
        <a
          href={`https://explorer.cow.fi/orders/${orderId}?chainId=${tokenInfo.chainId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary-400 hover:text-primary-300"
        >
          View order details →
        </a>
      </div>
    </div>
  );
}
