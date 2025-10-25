/**
 * TypeScript types for Zapper API responses
 * Based on Zapper GraphQL Schema
 */

export interface NetworkObject {
  id: number;
  name: string;
  slug: string;
  chainId: number;
}

export interface FungibleToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  imageUrlV2?: string | null;
}

export interface TokenBalance {
  tokenAddress: string;
  networkId: number;
  name: string;
  symbol: string;
  decimals: number;
  verified: boolean;
  price: number;
  balance: number;
  balanceUSD: number;
  balanceRaw: string;
  imgUrlV2?: string | null;
  network: NetworkObject;
}

export interface NetworkBalance {
  networkId: number;
  balanceUSD: number;
  network: NetworkObject;
}

export interface App {
  id: string;
  slug: string;
  displayName: string;
  imgUrl: string;
  url?: string;
}

export interface AppBalance {
  appId: string;
  networkId: number;
  balanceUSD: number;
  positionCount: number;
  app: App;
  network: NetworkObject;
}

export interface TokenBalances {
  totalBalanceUSD: number;
  byNetwork: {
    edges: Array<{
      node: NetworkBalance;
    }>;
  };
  byToken: {
    edges: Array<{
      node: TokenBalance;
    }>;
  };
}

export interface AppBalances {
  totalBalanceUSD: number;
  byNetwork: {
    edges: Array<{
      node: NetworkBalance;
    }>;
  };
  byApp: {
    edges: Array<{
      node: AppBalance;
    }>;
  };
}

export interface PortfolioMetadata {
  addresses: string[];
  networks: string[];
}

export interface PortfolioV2 {
  metadata: PortfolioMetadata;
  tokenBalances: TokenBalances;
  appBalances: AppBalances;
}

export interface PortfolioV2Response {
  portfolioV2: PortfolioV2;
}

// Transaction History Types

export interface Account {
  address: string;
  displayName: {
    value: string;
  };
}

export interface TokenDelta {
  address: string;
  amount: number;
  amountRaw: string;
  token: FungibleToken;
}

export interface PerspectiveDelta {
  tokenDeltasCount: number;
  nftDeltasCount: number;
  tokenDeltasV2: {
    edges: Array<{
      node: TokenDelta;
    }>;
  };
}

export interface TransactionInterpretation {
  processedDescription: string;
  inboundAttachmentsConnection?: {
    edges: Array<{
      node: Record<string, unknown>;
    }>;
  };
  outboundAttachmentsConnection?: {
    edges: Array<{
      node: Record<string, unknown>;
    }>;
  };
}

export interface OnChainTransaction {
  network: string;
  hash: string;
  timestamp: number;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gas: number;
}

export interface TimelineEventV2 {
  id: string;
  hash: string;
  eventHash: string;
  network: string;
  timestamp: number;
  fromAddress: Account;
  toAddress?: Account;
  value: string;
  interpretation: TransactionInterpretation;
  perspectiveDelta?: PerspectiveDelta;
  transaction: OnChainTransaction;
}

export interface FungibleDelta {
  address: string;
  amount: number;
  amountRaw: string;
  token: FungibleToken;
}

export interface ActivityTimelineEventDelta {
  id: string;
  transactionHash: string;
  network: string;
  transactionBlockTimestamp: number;
  perspectiveAccount: Account;
  from: Account;
  to?: Account;
  fungibleDeltas: FungibleDelta[];
}

export type TransactionHistoryEntry = TimelineEventV2 | ActivityTimelineEventDelta;

export interface TransactionHistoryV2 {
  edges: Array<{
    node: TransactionHistoryEntry;
  }>;
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string;
  };
  totalCount: number;
}

export interface TransactionHistoryV2Response {
  transactionHistoryV2: TransactionHistoryV2;
}

export interface TransactionDetailsV2Response {
  transactionDetailsV2: TimelineEventV2[];
}

// Helper type guards

export function isTimelineEventV2(
  entry: TransactionHistoryEntry
): entry is TimelineEventV2 {
  return 'hash' in entry && 'eventHash' in entry;
}

export function isActivityTimelineEventDelta(
  entry: TransactionHistoryEntry
): entry is ActivityTimelineEventDelta {
  return 'transactionHash' in entry && 'fungibleDeltas' in entry;
}

// Portfolio Summary Types for easier consumption

export interface NetworkSummary {
  chainId: number;
  name: string;
  slug: string;
  tokenBalanceUSD: number;
  appBalanceUSD: number;
  totalBalanceUSD: number;
  tokenCount: number;
  appCount: number;
}

export interface PortfolioSummary {
  totalBalanceUSD: number;
  tokenBalanceUSD: number;
  appBalanceUSD: number;
  networkSummaries: NetworkSummary[];
  topTokens: TokenBalance[];
  topApps: AppBalance[];
}
