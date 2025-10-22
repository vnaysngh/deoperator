# Find and load metadata for all coins created via Base App

> Learn how to use onchain data to index all Uniswap v4 pools created for coins created via Zora and Base App and load metadata including available liquidity, current prices, token information, and more

With the launch of Base App, users can post on the network and get paid by coining their content. The content coins are created via Zora and a Uniswap v4 pool is automatically created and initialized for the coin. In this starter guide we will cover how you can index onchain data from Uniswap to identify all pools containing Zora ecosystem tokens, filtering Base App tokens from them, and loading metadata for those pools.

## Overview

The full code for this starter implementation can be found [here](https://github.com/base/demos/tree/master/base-app-coins). The guide below explains the core components, how it works, and what parts you may need to customize to your needs.

The sample is a Bun + TypeScript project that uses `viem` for interacting with Base Chain via standard Ethereum JSON-RPC methods. It also utilizes Uniswap's SDKs to make some calculations easier.

## Core Components

#### 1. Event Monitoring (`index.ts`)

The main entry point scans Uniswap V4 `Initialize` events within a specified block range to discover newly created pools.

```typescript  theme={null}
const logs = await publicClient.getContractEvents({
    abi: UniswapV4ABI,
    address: UniswapV4PoolManager,
    fromBlock: START_BLOCK_NUMBER,
    toBlock: END_BLOCK_NUMBER,
    eventName: "Initialize"
})

const poolKeys = logs.map((log) => {
    return {
        currency0: log.args.currency0,
        currency1: log.args.currency1,
        fee: log.args.fee,
        tickSpacing: log.args.tickSpacing,
        hooks: log.args.hooks
    }
}) as PoolKey[]
```

**Key aspects:**

* Uses `publicClient.getContractEvents()` to fetch pool initialization events
* Filters events from the Uniswap V4 PoolManager contract
* Extracts pool keys (currency0, currency1, fee, tickSpacing, hooks) from event logs

**Customizations:**

* Adjust `START_BLOCK_NUMBER` and `END_BLOCK_NUMBER` for your needs
* If you'd like to index these events in real-time, use `viem`s `watchContractEvent` instead

#### 2. Pool Data Loading (`utils.ts`)

Contains utilities for enriching pool data with on-chain information.

```typescript  theme={null}
export async function loadData(key: PoolKey) {
    // Load information about each token (name, symbol, decimals)
    const [currency0, currency1] = await Promise.all([
        getCurrency(key.currency0),
        getCurrency(key.currency1)
    ])

    const poolId = Pool.getPoolId(currency0, currency1, key.fee, key.tickSpacing, key.hooks) as `0x${string}`;
    // Load the current price of the pool
    const [sqrtPriceX96, tick, _protocolFee, _lpFee] = await stateView.read.getSlot0([poolId]);
    // Load the total amount of liquidity available in the pool
    const liquidity = await stateView.read.getLiquidity([poolId])

    //
    const pool = new Pool(
        currency0,
        currency1,
        key.fee,
        key.tickSpacing,
        key.hooks,
        sqrtPriceX96.toString(),
        liquidity.toString(),
        tick,
    )
    return pool;
}
```

**Currency Resolution:**

```typescript  theme={null}
export async function getCurrency(address: string): Promise<Currency> {
    if (address === zeroAddress) {
        return Ether.onChain(base.id);
    }

    const erc20 = getContract({
        abi: erc20Abi,
        address: address as `0x${string}`,
        client: publicClient
    })

    const [name, symbol, decimals] = await Promise.all([
        erc20.read.name(),
        erc20.read.symbol(),
        erc20.read.decimals()
    ])

    return new Token(base.id, address, decimals, symbol, name)
}
```

**Technical details:**

* Uses Uniswap V4 StateView contract for efficient state queries
* Handles both ERC20 tokens and native ETH (zero address)

#### 3. Token Classification Logic

```typescript  theme={null}
let coinType: string | undefined;
if (key.hooks === "0xd61A675F8a0c67A73DC3B54FB7318B4D91409040") {
    coinType = "ZORA_CREATOR_COIN"
} else if (key.hooks === "0x9ea932730A7787000042e34390B8E435dD839040") {
    coinType = "ZORA_V4_COIN"
}

if (!coinType) continue;

// Detect if the coin is coming from Base App or Zora
const appType = await categorizeAppType(pool);
```

**Base App Token Detection:**

```typescript  theme={null}

export async function categorizeAppType(pool: Pool) {
    async function tryGetPlatformReferrer(address: string) {
        const zoraBaseCoin = getContract({
            abi: parseAbi([
                "function platformReferrer() view returns (address)",
            ]),
            address: address as `0x${string}`,
            client: publicClient
        })

        try {
            const platformReferrer = await zoraBaseCoin.read.platformReferrer()
            return platformReferrer
        } catch (error) {
            return ADDRESS_ZERO
        }
    }

    // Try to fetch `platformReferrer()` on both currencies in the Pool
    // falling back to ADDRESS_ZERO if the function does not exist (currency is not a Zora coin)
    const [currency0PlatformReferrer, currency1PlatformReferrer] = await Promise.all([
        tryGetPlatformReferrer(pool.currency0.wrapped.address),
        tryGetPlatformReferrer(pool.currency1.wrapped.address)
    ])

    // If either of the currencies has the Base App referrer address,
    // the coin is coming from the Base App
    if ([currency0PlatformReferrer, currency1PlatformReferrer].includes(BASE_PLATFORM_REFERRER)) {
        return "TBA"
    }

    return "ZORA"
}
```

Since the coins are created via Zora, filtering down to which ones are from Base App is a matter of looking at what the platform referrer address is on the Zora coin. We don't know if the Zora coin is necessarily `currency0` or `currency1` in the pool - so we attempt to fetch the platform referrer address for both. For tokens like WETH which don't have that view function available, it will just fall back to the zero address. If either of the currencies return a valid platform referrer address that also matches the referrer address used by the Base App, we classify the coin as having come from the Base App.

#### 4. Liquidity Calculations

```typescript  theme={null}
const priceUpper = TickMath.getSqrtRatioAtTick(TickMath.MAX_TICK)
const priceLower = TickMath.getSqrtRatioAtTick(TickMath.MIN_TICK)

const amount0 = SqrtPriceMath.getAmount0Delta(pool.sqrtRatioX96, priceUpper, pool.liquidity, true);
const amount1 = SqrtPriceMath.getAmount1Delta(priceLower, pool.sqrtRatioX96, pool.liquidity, true)

const amount0HumanReadable = formatUnits(BigInt(amount0.toString()), pool.currency0.decimals);
const amount1HumanReadable = formatUnits(BigInt(amount1.toString()), pool.currency1.decimals);
```

Given the `liquidity` amount we loaded previously for a pool, we utilize Uniswap's SDK to do some math and get human-friendly versions of how much of each token is available in the pool as total liquidity.

## Alternative Implementation Approaches

### Event Data Sources

This implementation uses direct JSON-RPC calls via `viem`, but you can adapt it for other data sources:

**Subgraphs**: If you're already using The Graph Protocol, modify the event fetching logic to query a Uniswap V4 subgraph instead of making direct RPC calls. Replace the `getContractEvents` call with GraphQL queries.

**Indexing Services**: For projects using third-party indexing services with their own APIs, substitute their event APIs while maintaining the same pool key extraction logic.

**Real-time Monitoring**: Convert from batch processing to real-time by setting up WebSocket subscriptions to new block events and processing pools as they're created.

### Data Storage

The current implementation prints metadata to console, but you might want to:

* Store results in a database for persistent analysis
* Send data to external APIs or webhooks
* Cache results to avoid re-processing known pools

## Output

The output metadata object contains the following fields:

```typescript  theme={null}
const metadata = {
    id: pool.poolId,
    key: pool.poolKey,
    currency0: {
        name: pool.currency0.name,
        symbol: pool.currency0.symbol,
        decimals: pool.currency0.decimals,
        address: pool.currency0.wrapped.address,
    },
    currency1: {
        name: pool.currency1.name,
        symbol: pool.currency1.symbol,
        decimals: pool.currency1.decimals,
        address: pool.currency1.wrapped.address,
    },
    sqrtPriceX96: pool.sqrtRatioX96.toString(),
    tick: pool.tickCurrent,
    liquidity: pool.liquidity.toString(),
    liquidityCurrency0: amount0.toString(),
    liquidityCurrency1: amount1.toString(),
    liquidityCurrency0HumanReadable: `${amount0HumanReadable} ${pool.currency0.symbol}`,
    liquidityCurrency1HumanReadable: `${amount1HumanReadable} ${pool.currency1.symbol}`,
    currency0Price,
    currency1Price,
    currency0PriceHumanReadable: `1 ${pool.currency0.symbol} = ${currency0Price} ${pool.currency1.symbol}`,
    currency1PriceHumanReadable: `1 ${pool.currency1.symbol} = ${currency1Price} ${pool.currency0.symbol}`,
    coinType,
    appType
}
```

### Pool Identifiers

* `id`: Unique pool identifier hash
* `key`: Complete pool key object with currencies, fee, tickSpacing, and hooks

### Currency Information

* `currency0/currency1.name`: Human-readable token name
* `currency0/currency1.symbol`: Token symbol (e.g., "USDC", "WETH")
* `currency0/currency1.decimals`: Token decimal places for formatting
* `currency0/currency1.address`: Contract address

### Price Data

* `sqrtPriceX96`: Current pool price in Uniswap's sqrt format
* `tick`: Current tick (logarithmic price representation)
* `currency0Price`: Price of currency0 in terms of currency1
* `currency1Price`: Price of currency1 in terms of currency0
* `currency0PriceHumanReadable`: Formatted price string
* `currency1PriceHumanReadable`: Formatted price string

### Liquidity Metrics

* `liquidity`: Total pool liquidity in Uniswap's internal format
* `liquidityCurrency0`: Amount of currency0 in the pool (raw)
* `liquidityCurrency1`: Amount of currency1 in the pool (raw)
* `liquidityCurrency0HumanReadable`: Formatted amount with symbol
* `liquidityCurrency1HumanReadable`: Formatted amount with symbol

### Classification

* `coinType`: Type of Zora token ("ZORA\_CREATOR\_COIN" or "ZORA\_V4\_COIN")
* `appType`: Application ecosystem ("ZORA" or "TBA")

## Use Cases for Metadata

### Analytics & Monitoring

* **Price Tracking**: Monitor token prices and price movements over time
* **Liquidity Analysis**: Track total value locked (TVL) in various token pools
* **Market Discovery**: Identify new tokens entering the ecosystem

### Trading & DeFi

* **Arbitrage Detection**: Compare prices across different pools or DEXs
* **Liquidity Provider Analysis**: Evaluate pool attractiveness for LP positions
* **Volume Analysis**: Track trading activity in specific token categories

### Ecosystem Analysis

* **Token Categorization**: Understand which tokens belong to which ecosystems
* **Adoption Metrics**: Monitor growth of Zora and Base App token usage
* **Cross-chain Comparison**: Compare activity across different networks

### Integration Projects

* **Portfolio Tracking**: Include Zora/Base App tokens in portfolio management apps
* **Wallet Integration**: Enhance wallet UIs with ecosystem-specific token information
* **DeFi Protocols**: Build lending, staking, or yield farming products around these tokens

## Configuration

### Environment Variables

* `RPC_URL`: Base chain RPC endpoint (required)

### Block Range

Modify `START_BLOCK_NUMBER` and `END_BLOCK_NUMBER` in `index.ts` to scan different ranges or implement continuous monitoring.

### Hook Addresses

Add new hook addresses to the classification logic as new Zora contracts are deployed.

## Getting Started

```bash  theme={null}
# Install dependencies
bun install

# Set your RPC URL
export RPC_URL="your-base-rpc-endpoint"

# Run the scanner
bun run index.ts
```

The output will display metadata for each discovered pool that matches the classification criteria.

## Extensions & Modifications

This starter guide can be extended in many ways:

* Add support for additional hook contracts as they're deployed
* Include historical price and volume data
* Add alerts for significant liquidity changes
* Build web interfaces for browsing discovered pools
* Integrate with portfolio tracking or trading applications

The modular structure makes it easy to adapt individual components while maintaining the core pool discovery and classification logic.
