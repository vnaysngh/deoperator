import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { arbitrum, base, bsc, mainnet, polygon } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

if (!projectId) {
  console.warn(
    "WalletConnect Project ID is missing. Please add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to your .env.local file."
  );
}

type ChainWithRpcUrls = {
  rpcUrls: {
    default: { http: readonly string[] }
  }
};

function resolveRpcUrl(
  envVar: string | undefined,
  chain: ChainWithRpcUrls
): string {
  if (envVar && envVar.length > 0) {
    return envVar;
  }

  const publicUrls =
    (chain.rpcUrls as { public?: { http: readonly string[] } }).public?.http;
  if (publicUrls && publicUrls.length > 0) {
    return publicUrls[0];
  }

  const defaultUrls = chain.rpcUrls.default.http;
  if (defaultUrls.length > 0) {
    return defaultUrls[0];
  }

  throw new Error("No RPC URL available for the configured chain.");
}

export const config = getDefaultConfig({
  appName: "DexLuthor",
  projectId,
  chains: [mainnet, bsc, polygon, base, arbitrum],
  transports: {
    [mainnet.id]: http(
      resolveRpcUrl(
        process.env.NEXT_PUBLIC_MAINNET_RPC_URL,
        mainnet
      )
    ),
    [bsc.id]: http(
      resolveRpcUrl(
        process.env.NEXT_PUBLIC_BSC_RPC_URL,
        bsc
      )
    ),
    [polygon.id]: http(
      resolveRpcUrl(
        process.env.NEXT_PUBLIC_POLYGON_RPC_URL,
        polygon
      )
    ),
    [base.id]: http(
      resolveRpcUrl(
        process.env.NEXT_PUBLIC_BASE_RPC_URL,
        base
      )
    ),
    [arbitrum.id]: http(
      resolveRpcUrl(
        process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL,
        arbitrum
      )
    )
  },
  ssr: true
});
