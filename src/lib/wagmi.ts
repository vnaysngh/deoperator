import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, sepolia, arbitrum, polygon, bsc } from "wagmi/chains";
import { defineChain } from "viem";

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
  chains: [mainnet, arbitrum, polygon, bsc, unichain, sepolia],
  ssr: true
});
