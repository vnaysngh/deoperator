/**
 * Zapper API GraphQL Client
 * Provides utilities for interacting with the Zapper API
 * API Documentation: https://build.zapper.xyz/docs/api/
 */

const ZAPPER_API_URL = 'https://public.zapper.xyz/graphql';
const ZAPPER_API_KEY = process.env.ZAPPER_API_KEY;

if (!ZAPPER_API_KEY) {
  console.warn('⚠️ ZAPPER_API_KEY is not set in environment variables');
}

/**
 * Makes a GraphQL request to the Zapper API
 */
async function makeZapperRequest<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const response = await fetch(ZAPPER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-zapper-api-key': ZAPPER_API_KEY || '',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`Zapper API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    console.error('Zapper GraphQL Errors:', result.errors);
    throw new Error(`GraphQL Errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

/**
 * Fetches portfolio data for given addresses
 */
export async function fetchPortfolioV2(
  addresses: string[],
  chainIds?: number[]
) {
  const query = `
    query PortfolioV2Query($addresses: [Address!]!, $chainIds: [Int!]) {
      portfolioV2(addresses: $addresses, chainIds: $chainIds) {
        metadata {
          addresses
          networks
        }
        tokenBalances {
          totalBalanceUSD
          byNetwork(first: 20) {
            edges {
              node {
                networkId
                balanceUSD
                network {
                  id
                  name
                  slug
                  chainId
                }
              }
            }
          }
          byToken(first: 50, filters: { minBalanceUSD: 0.01 }) {
            edges {
              node {
                tokenAddress
                networkId
                name
                symbol
                decimals
                verified
                price
                balance
                balanceUSD
                balanceRaw
                imgUrlV2
                network {
                  id
                  name
                  slug
                  chainId
                }
              }
            }
          }
        }
        appBalances {
          totalBalanceUSD
          byNetwork(first: 20) {
            edges {
              node {
                networkId
                balanceUSD
                network {
                  id
                  name
                  slug
                  chainId
                }
              }
            }
          }
          byApp(first: 50, filters: { minBalanceUSD: 0.01 }) {
            edges {
              node {
                appId
                networkId
                balanceUSD
                positionCount
                app {
                  id
                  slug
                  displayName
                  imgUrl
                  url
                }
                network {
                  id
                  name
                  slug
                  chainId
                }
              }
            }
          }
        }
      }
    }
  `;

  return makeZapperRequest(query, { addresses, chainIds });
}

/**
 * Fetches transaction history for given addresses
 * Note: Zapper API has a maximum of 20 items per request
 */
export async function fetchTransactionHistory(
  subjects: string[],
  perspective: 'Signer' | 'Receiver' | 'All' = 'Signer',
  first: number = 20,
  after?: string,
  filters?: {
    chainIds?: number[];
    startDate?: number;
    endDate?: number;
    orderByDirection?: 'ASC' | 'DESC';
  }
) {
  // Cap at maximum allowed by Zapper API
  const cappedFirst = Math.min(first, 20);
  const query = `
    query TransactionHistoryV2Query(
      $subjects: [Address!]!
      $perspective: TransactionHistoryV2Perspective
      $first: Int
      $after: String
      $filters: TransactionHistoryV2FiltersArgs
    ) {
      transactionHistoryV2(
        subjects: $subjects
        perspective: $perspective
        first: $first
        after: $after
        filters: $filters
      ) {
        edges {
          node {
            ... on TimelineEventV2 {
              id
              hash
              eventHash
              network
              timestamp
              fromAddress {
                address
                displayName {
                  value
                }
              }
              toAddress {
                address
                displayName {
                  value
                }
              }
              value
              interpretation {
                processedDescription
              }
              perspectiveDelta {
                tokenDeltasCount
                nftDeltasCount
                tokenDeltasV2(first: 10) {
                  edges {
                    node {
                      address
                      amount
                      amountRaw
                      token {
                        address
                        name
                        symbol
                        decimals
                        imageUrlV2
                      }
                    }
                  }
                }
              }
              transaction {
                network
                hash
                timestamp
                from
                to
                value
                gasPrice
                gas
              }
            }
            ... on ActivityTimelineEventDelta {
              id
              transactionHash
              network
              transactionBlockTimestamp
              perspectiveAccount {
                address
                displayName {
                  value
                }
              }
              from {
                address
                displayName {
                  value
                }
              }
              to {
                address
                displayName {
                  value
                }
              }
              fungibleDeltas {
                address
                amount
                amountRaw
                token {
                  address
                  name
                  symbol
                  decimals
                  imageUrlV2
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
    }
  `;

  return makeZapperRequest(query, {
    subjects,
    perspective,
    first: cappedFirst,
    after,
    filters,
  });
}

/**
 * Fetches detailed information about a specific transaction
 */
export async function fetchTransactionDetails(
  hash: string,
  chainId: number,
  subject?: string
) {
  const query = `
    query TransactionDetailsV2Query($hash: String!, $chainId: Int!, $subject: Address) {
      transactionDetailsV2(hash: $hash, chainId: $chainId, subject: $subject) {
        id
        hash
        eventHash
        network
        timestamp
        fromAddress {
          address
          displayName {
            value
          }
        }
        toAddress {
          address
          displayName {
            value
          }
        }
        value
        interpretation {
          processedDescription
          inboundAttachmentsConnection(first: 10) {
            edges {
              node {
                ... on TokenDisplayItem {
                  type
                  network
                  tokenAddress
                  amountRaw
                  token {
                    address
                    name
                    symbol
                    decimals
                    imageUrlV2
                  }
                }
                ... on NFTDisplayItem {
                  type
                  network
                  collectionAddress
                  tokenId
                  quantity
                }
              }
            }
          }
          outboundAttachmentsConnection(first: 10) {
            edges {
              node {
                ... on TokenDisplayItem {
                  type
                  network
                  tokenAddress
                  amountRaw
                  token {
                    address
                    name
                    symbol
                    decimals
                    imageUrlV2
                  }
                }
                ... on NFTDisplayItem {
                  type
                  network
                  collectionAddress
                  tokenId
                  quantity
                }
              }
            }
          }
        }
        transaction {
          network
          hash
          timestamp
          from
          to
          value
          gasPrice
          gas
        }
      }
    }
  `;

  return makeZapperRequest(query, { hash, chainId, subject });
}

/**
 * Maps Zapper Network enum to chain ID
 */
export const NETWORK_TO_CHAIN_ID: Record<string, number> = {
  ETHEREUM_MAINNET: 1,
  POLYGON_MAINNET: 137,
  OPTIMISM_MAINNET: 10,
  ARBITRUM_MAINNET: 42161,
  BASE_MAINNET: 8453,
  AVALANCHE_MAINNET: 43114,
  BINANCE_SMART_CHAIN_MAINNET: 56,
  FANTOM_OPERA_MAINNET: 250,
  GNOSIS_MAINNET: 100,
  CELO_MAINNET: 42220,
  MOONRIVER_MAINNET: 1285,
  CRONOS_MAINNET: 25,
  AURORA_MAINNET: 1313161554,
  BLAST_MAINNET: 81457,
  DEGEN_MAINNET: 666666666,
  MODE_MAINNET: 34443,
  ZKSYNC_MAINNET: 324,
  MANTLE_MAINNET: 5000,
  SCROLL_MAINNET: 534352,
  MOONBEAM_MAINNET: 1284,
  LINEA_MAINNET: 59144,
  ZORA_MAINNET: 7777777,
  METIS_MAINNET: 1088,
};

/**
 * Maps chain ID to Zapper Network enum
 */
export const CHAIN_ID_TO_NETWORK: Record<number, string> = Object.entries(
  NETWORK_TO_CHAIN_ID
).reduce((acc, [network, chainId]) => {
  acc[chainId] = network;
  return acc;
}, {} as Record<number, string>);

/**
 * Gets supported chain IDs from Zapper
 */
export function getSupportedChainIds(): number[] {
  return Object.values(NETWORK_TO_CHAIN_ID);
}

/**
 * Checks if a chain ID is supported by Zapper
 */
export function isChainSupported(chainId: number): boolean {
  return chainId in CHAIN_ID_TO_NETWORK;
}
