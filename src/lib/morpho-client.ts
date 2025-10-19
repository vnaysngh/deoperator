import { metaMorphoAbi } from "@morpho-org/blue-sdk-viem";
import type { Address, PublicClient, WalletClient, Hash } from "viem";
import { erc20Abi } from "viem";
import { CHAIN_IDS, getChainName } from "./chains";

const MORPHO_GRAPHQL_ENDPOINT = "https://api.morpho.org/graphql";

export const SUPPORTED_MORPHO_CHAIN_IDS = [
  CHAIN_IDS.ETHEREUM,
  CHAIN_IDS.ARBITRUM,
  CHAIN_IDS.BASE
] as const;

export const SUPPORTED_MORPHO_ASSETS = ["USDC", "WETH"] as const;

export type SupportedMorphoChainId = (typeof SUPPORTED_MORPHO_CHAIN_IDS)[number];
export type SupportedMorphoAsset = (typeof SUPPORTED_MORPHO_ASSETS)[number];

type MorphoVaultState = {
  totalAssets: string;
  totalAssetsUsd: number | null;
  apy: number | null;
  netApy: number | null;
};

type MorphoVaultItem = {
  address: Address;
  name: string;
  symbol: string;
  asset: {
    symbol: string;
    address: Address;
    decimals: number;
  };
  chain: {
    id: number;
    network: string;
  };
  state: MorphoVaultState | null;
};

type MorphoVaultsResponse = {
  data?: {
    vaults?: {
      items?: MorphoVaultItem[];
    };
  };
  errors?: Array<{ message?: string }>;
};

export type MorphoVaultSummary = {
  vaultAddress: Address;
  assetAddress: Address;
  assetSymbol: SupportedMorphoAsset;
  assetDecimals: number;
  chainId: SupportedMorphoChainId;
  chainLabel: string;
  tvlUsd: number | null;
  totalAssets: string | null;
  apy: number | null;
  netApy: number | null;
  vaultName?: string;
  vaultSymbol?: string;
};

const TOP_VAULT_QUERY = /* GraphQL */ `
  query TopVault($chainIds: [Int!], $assetSymbols: [String!]) {
    vaults(
      first: 1
      orderBy: TotalAssetsUsd
      orderDirection: Desc
      where: {
        chainId_in: $chainIds
        assetSymbol_in: $assetSymbols
        whitelisted: true
      }
    ) {
      items {
        address
        name
        symbol
        asset {
          symbol
          address
          decimals
        }
        chain {
          id
          network
        }
        state {
          totalAssets
          totalAssetsUsd
          apy
          netApy
        }
      }
    }
  }
`;

function isSupportedChainId(chainId: number): chainId is SupportedMorphoChainId {
  return SUPPORTED_MORPHO_CHAIN_IDS.includes(chainId as SupportedMorphoChainId);
}

function isSupportedAssetSymbol(symbol: string): symbol is SupportedMorphoAsset {
  return SUPPORTED_MORPHO_ASSETS.includes(symbol.toUpperCase() as SupportedMorphoAsset);
}

export async function fetchTopMorphoVault(params: {
  chainId: number;
  assetSymbol: string;
}): Promise<MorphoVaultSummary | null> {
  const { chainId, assetSymbol } = params;

  if (!isSupportedChainId(chainId)) {
    console.warn(
      `[MORPHO] Unsupported chain requested for vault lookup: ${chainId}`
    );
    return null;
  }

  if (!isSupportedAssetSymbol(assetSymbol)) {
    console.warn(
      `[MORPHO] Unsupported asset requested for vault lookup: ${assetSymbol}`
    );
    return null;
  }

  try {
    const response = await fetch(MORPHO_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: TOP_VAULT_QUERY,
        variables: {
          chainIds: [chainId],
          assetSymbols: [assetSymbol.toUpperCase()]
        }
      })
    });

    if (!response.ok) {
      console.error(
        "[MORPHO] Failed to fetch vault data:",
        response.status,
        response.statusText
      );
      return null;
    }

    const json = (await response.json()) as MorphoVaultsResponse;

    if (json.errors && json.errors.length > 0) {
      console.error("[MORPHO] GraphQL errors returned:", json.errors);
      return null;
    }

    const items = json.data?.vaults?.items ?? [];
    const vault = items[0];

    if (!vault) {
      console.warn(
        `[MORPHO] No vault found for ${assetSymbol} on chain ${chainId}`
      );
      return null;
    }

    if (!vault.asset?.address) {
      console.warn(
        `[MORPHO] Vault response missing asset data for ${assetSymbol} on chain ${chainId}`
      );
      return null;
    }

    const state = vault.state;

    return {
      vaultAddress: vault.address,
      vaultName: vault.name,
      vaultSymbol: vault.symbol,
      assetAddress: vault.asset.address,
      assetDecimals: Number(vault.asset.decimals),
      assetSymbol: vault.asset.symbol as SupportedMorphoAsset,
      chainId: vault.chain.id as SupportedMorphoChainId,
      chainLabel: getChainName(vault.chain.id),
      tvlUsd: state?.totalAssetsUsd ?? null,
      totalAssets: state?.totalAssets ?? null,
      apy: state?.apy ?? null,
      netApy: state?.netApy ?? null
    };
  } catch (error) {
    console.error("[MORPHO] Unexpected error while fetching vault data:", error);
    return null;
  }
}

export async function fetchTopVaultsForChain(
  chainId: number
): Promise<Record<SupportedMorphoAsset, MorphoVaultSummary | null>> {
  const result: Partial<
    Record<SupportedMorphoAsset, MorphoVaultSummary | null>
  > = {};

  for (const assetSymbol of SUPPORTED_MORPHO_ASSETS) {
    result[assetSymbol] = await fetchTopMorphoVault({ chainId, assetSymbol });
  }

  return result as Record<SupportedMorphoAsset, MorphoVaultSummary | null>;
}

export async function getMorphoVaultAllowance(
  publicClient: PublicClient,
  params: {
    assetAddress: Address;
    owner: Address;
    vaultAddress: Address;
  }
): Promise<bigint> {
  const { assetAddress, owner, vaultAddress } = params;

  return publicClient.readContract({
    address: assetAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, vaultAddress]
  });
}

export async function approveMorphoVault(
  walletClient: WalletClient,
  params: {
    assetAddress: Address;
    owner: Address;
    vaultAddress: Address;
    amount: bigint;
  }
): Promise<Hash> {
  const { assetAddress, owner, vaultAddress, amount } = params;

  return walletClient.writeContract({
    address: assetAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [vaultAddress, amount],
    account: owner,
    chain: walletClient.chain
  });
}

export async function depositIntoMorphoVault(
  walletClient: WalletClient,
  params: {
    vaultAddress: Address;
    owner: Address;
    assets: bigint;
    receiver?: Address;
  }
): Promise<Hash> {
  const { vaultAddress, owner, assets, receiver } = params;

  return walletClient.writeContract({
    address: vaultAddress,
    abi: metaMorphoAbi,
    functionName: "deposit",
    args: [assets, receiver ?? owner],
    account: owner,
    chain: walletClient.chain
  });
}
