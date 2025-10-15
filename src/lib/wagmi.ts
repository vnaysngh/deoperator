import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrum, bsc } from "wagmi/chains";
import { defineChain } from "viem";
import { http } from "wagmi";

// Define Unichain mainnet
const unichain = defineChain({
  id: 130,
  name: "Unichain",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH"
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.unichain.org"]
    }
  },
  blockExplorers: {
    default: {
      name: "Uniscan",
      url: "https://uniscan.xyz"
    }
  }
});

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

if (!projectId) {
  console.warn(
    "WalletConnect Project ID is missing. Please add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to your .env.local file."
  );
}

export const config = getDefaultConfig({
  appName: "DexLuthor",
  projectId,
  chains: [arbitrum, bsc],
  transports: {
    [arbitrum.id]: http(
      process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL || "https://arbitrum-one.public.blastapi.io"
    ),
    [bsc.id]: http(
      process.env.NEXT_PUBLIC_BSC_RPC_URL || "https://bsc-dataseed1.binance.org"
    )
  },
  ssr: true
});
