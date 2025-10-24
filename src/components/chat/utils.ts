import type { Address, PublicClient, WalletClient } from "viem";

export async function ensureClientsOnChain({
  targetChainId,
  address,
  publicClient,
  walletClient
}: {
  targetChainId: number;
  address?: Address;
  publicClient?: PublicClient;
  walletClient?: WalletClient;
}): Promise<{
  publicClient: PublicClient;
  walletClient: WalletClient;
}> {
  if (!address) {
    throw new Error("WALLET_NOT_CONNECTED");
  }

  const { wagmiAdapter } = await import("@/lib/wagmi");
  const { getWalletClient, getPublicClient } = await import("wagmi/actions");

  let resolvedWalletClient: WalletClient | undefined = walletClient;
  if (!resolvedWalletClient) {
    resolvedWalletClient = await getWalletClient(wagmiAdapter.wagmiConfig, {
      account: address,
      assertChainId: false
    });
  }

  if (!resolvedWalletClient) {
    throw new Error("WALLET_CLIENT_UNAVAILABLE");
  }

  if (resolvedWalletClient.chain?.id !== targetChainId) {
    try {
      const { switchChain } = await import("@wagmi/core");
      await switchChain(wagmiAdapter.wagmiConfig, {
        chainId: targetChainId
      });
      resolvedWalletClient = await getWalletClient(wagmiAdapter.wagmiConfig, {
        account: address,
        assertChainId: false
      });
    } catch (switchError) {
      if (
        switchError instanceof Error &&
        (switchError.name === "UserRejectedRequestError" ||
          switchError.message.toLowerCase().includes("user rejected"))
      ) {
        throw new Error("USER_REJECTED_SWITCH");
      }
      if (
        switchError instanceof Error &&
        switchError.name === "SwitchChainNotSupportedError"
      ) {
        throw new Error("SWITCH_NOT_SUPPORTED");
      }
      throw switchError instanceof Error
        ? switchError
        : new Error("SWITCH_FAILED");
    }
  }

  if (resolvedWalletClient.chain?.id !== targetChainId) {
    throw new Error("CHAIN_NOT_MATCHING");
  }

  let resolvedPublicClient: PublicClient | undefined = publicClient;
  if (
    !resolvedPublicClient ||
    resolvedPublicClient.chain?.id !== targetChainId
  ) {
    resolvedPublicClient = await getPublicClient(wagmiAdapter.wagmiConfig, {
      chainId: targetChainId
    });
  }

  if (!resolvedPublicClient) {
    throw new Error("PUBLIC_CLIENT_UNAVAILABLE");
  }

  return {
    publicClient: resolvedPublicClient,
    walletClient: resolvedWalletClient
  };
}

export function describeSwitchError(
  error: unknown,
  chainLabel: string
): { message: string; manualSwitch: boolean } {
  if (error instanceof Error) {
    if (error.message === "WALLET_NOT_CONNECTED") {
      return {
        message: "Connect your wallet to continue.",
        manualSwitch: false
      };
    }

    if (error.message === "USER_REJECTED_SWITCH") {
      return {
        message: `Looks like you cancelled the network switch. Approve the request to continue on ${chainLabel}.`,
        manualSwitch: false
      };
    }

    if (error.message === "SWITCH_NOT_SUPPORTED") {
      return {
        message: `Your wallet can't change networks automatically. Please switch to ${chainLabel} in your wallet and try again.`,
        manualSwitch: true
      };
    }

    if (error.message === "CHAIN_NOT_MATCHING") {
      return {
        message: `We couldn't confirm the network change. Switch to ${chainLabel} manually and try once more.`,
        manualSwitch: true
      };
    }

    if (error.message === "WALLET_CLIENT_UNAVAILABLE") {
      return {
        message:
          "I couldn't reach your wallet. Try reconnecting it and then retry.",
        manualSwitch: false
      };
    }

    if (error.message === "PUBLIC_CLIENT_UNAVAILABLE") {
      return {
        message:
          "Unable to reach the selected network right now. Please try again shortly.",
        manualSwitch: false
      };
    }

    return {
      message: error.message,
      manualSwitch: true
    };
  }

  return {
    message:
      "An unexpected network error occurred. Please try switching manually.",
    manualSwitch: true
  };
}
