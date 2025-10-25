/**
 * Quick test script for the GTE SDK
 * Run with: node test-gte-sdk.js
 */

import { GteSdk } from "gte-typescript-sdk";

async function main() {
  console.log("🚀 Testing GTE SDK...\n");

  const sdk = new GteSdk();

  // 1. Get chain config
  console.log("1. Chain Configuration:");
  const config = sdk.getChainConfig();
  console.log(JSON.stringify(config, null, 2));
  console.log("\n");

  // 2. Fetch markets
  console.log("2. Fetching markets (limit: 3)...");
  try {
    const markets = await sdk.getMarkets({ marketType: "amm", limit: 3 });
    console.log(`Found ${markets.length} markets:`);
    markets.forEach((market, i) => {
      console.log(`\n  Market ${i + 1}:`);
      console.log(`    Address: ${market.address}`);
      console.log(`    Base: ${market.baseToken.symbol} (${market.baseToken.address})`);
      console.log(`    Quote: ${market.quoteToken.symbol} (${market.quoteToken.address})`);
      console.log(`    Price: $${market.priceUsd}`);
      console.log(`    TVL: $${market.tvlUsd}`);
    });
    console.log("\n");

    // 3. Get quote for first market
    if (markets.length > 0) {
      console.log("3. Getting quote for first market...");
      const firstMarket = markets[0];
      try {
        const quote = await sdk.getQuote({
          tokenIn: firstMarket.baseToken,
          tokenOut: firstMarket.quoteToken,
          amountIn: "0.1",
        });
        console.log("Quote result:");
        // Handle BigInt serialization
        console.log(JSON.stringify(quote, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        , 2));
        console.log("\n");

        // 4. Build transactions
        console.log("4. Building approval transaction...");
        const approveTx = await sdk.buildApprove({
          tokenAddress: firstMarket.baseToken.address,
        });
        console.log("Approve transaction:");
        console.log(`  To: ${approveTx.to}`);
        console.log(`  Data: ${approveTx.data.slice(0, 66)}...`);
        console.log(`  Value: ${approveTx.value}`);
        console.log("\n");

        console.log("5. Building swap transaction...");
        const { tx: swapTx } = await sdk.buildSwapExactIn({
          tokenIn: firstMarket.baseToken,
          tokenOut: firstMarket.quoteToken,
          amountIn: "0.1",
          quote,
          recipient: "0x0000000000000000000000000000000000000000",
        });
        console.log("Swap transaction:");
        console.log(`  To: ${swapTx.to}`);
        console.log(`  Data: ${swapTx.data.slice(0, 66)}...`);
        console.log(`  Value: ${swapTx.value}`);
        console.log("\n");

        console.log("✅ All SDK methods working successfully!");
      } catch (quoteError) {
        console.error("❌ Error getting quote:", quoteError.message);
      }
    } else {
      console.log("No markets available for testing quotes");
    }
  } catch (marketError) {
    console.error("❌ Error fetching markets:", marketError.message);
    throw marketError;
  }
}

main().catch((error) => {
  console.error("\n❌ Test failed:");
  console.error(error);
  process.exit(1);
});
