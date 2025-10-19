import { cookieStorage, createStorage } from "@wagmi/core";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import {
  arbitrum,
  base,
  mainnet
  // polygon
} from "@reown/appkit/networks";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  process.env.NEXT_PUBLIC_PROJECT_ID ||
  "";

if (!projectId) {
  console.warn(
    "WalletConnect Project ID is missing. Please add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to your .env.local file."
  );
}

export const networks = [mainnet, /* bsc, */ /* polygon, */ base, arbitrum];

export const wagmiAdapter = new WagmiAdapter({
  projectId: projectId || "demo",
  networks,
  ssr: true,
  storage: createStorage({
    storage: cookieStorage
  })
});

export const config = wagmiAdapter.wagmiConfig;
export { projectId };
