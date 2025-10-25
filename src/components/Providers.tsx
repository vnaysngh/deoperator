"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  WagmiProvider,
  cookieToInitialState,
  type Config as WagmiConfig
} from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { ErrorBoundary } from "./ErrorBoundary";
import { DisclaimerDialog } from "./DisclaimerDialog";
import { networks, projectId, wagmiAdapter } from "@/lib/wagmi";
import {
  arbitrum,
  base,
  /* bsc, */ mainnet /*, polygon */,
  megaethTestnet
} from "@reown/appkit/networks";
import { appWalletMetadata } from "@/lib/appMetadata";

type ProvidersProps = {
  children: ReactNode;
  cookies?: string | null;
};

type AppKitWindow = Window &
  typeof globalThis & {
    __APP_KIT_MODAL__?: ReturnType<typeof createAppKit>;
  };

function ensureAppKitInstance() {
  if (typeof window === "undefined") {
    return undefined;
  }

  const extendedWindow = window as AppKitWindow;
  if (extendedWindow.__APP_KIT_MODAL__) {
    return extendedWindow.__APP_KIT_MODAL__;
  }

  if (!projectId) {
    return undefined;
  }

  const modal = createAppKit({
    adapters: [wagmiAdapter],
    projectId,
    networks: [base, mainnet, arbitrum, megaethTestnet],
    defaultNetwork: networks[0],
    metadata: appWalletMetadata,
    features: {
      analytics: true
    },
    enableReconnect: true,
    allowUnsupportedChain: true
  });

  extendedWindow.__APP_KIT_MODAL__ = modal;
  return modal;
}

export function openAppKitModal() {
  if (!projectId) {
    console.warn(
      "WalletConnect Project ID is not configured. Unable to open AppKit modal."
    );
    return;
  }

  const modal = ensureAppKitInstance();
  modal?.open();
}

export function Providers({ children, cookies }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is considered fresh for 1 minute
            staleTime: 60 * 1000,
            // Cache data for 5 minutes
            gcTime: 5 * 60 * 1000,
            // Retry failed requests once
            retry: 1,
            // Refetch on window focus for real-time blockchain data
            refetchOnWindowFocus: true,
            // Don't refetch on mount if data is fresh
            refetchOnMount: false
          }
        }
      })
  );

  useEffect(() => {
    ensureAppKitInstance();
  }, []);

  const initialState = useMemo(
    () =>
      cookieToInitialState(
        wagmiAdapter.wagmiConfig as WagmiConfig,
        cookies ?? undefined
      ),
    [cookies]
  );

  return (
    <ErrorBoundary>
      <WagmiProvider
        config={wagmiAdapter.wagmiConfig as WagmiConfig}
        initialState={initialState}
      >
        <QueryClientProvider client={queryClient}>
          <DisclaimerDialog />
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  );
}
