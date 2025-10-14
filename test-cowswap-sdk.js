/**
 * Test script for CoW Protocol Trading SDK implementation
 * Run with: node test-cowswap-sdk.js
 */

const { getCowSwapQuoteSDK, getQuoteForOrder } = require('./src/lib/cowswap-sdk.ts');

console.log('========================================');
console.log('🧪 Testing CoW Protocol Trading SDK');
console.log('========================================\n');

async function testGetQuote() {
  console.log('📊 Test 1: getCowSwapQuoteSDK()');
  console.log('----------------------------');
  console.log('Testing: Swap 10 ARB → USDC on Arbitrum (chainId: 42161)');

  try {
    const result = await getCowSwapQuoteSDK(
      'ARB',         // fromToken
      'USDC',        // toToken
      '10',          // amount
      undefined,     // userAddress (optional for quotes)
      42161,         // chainId (Arbitrum)
      0.005          // slippage (0.5%)
    );

    console.log('\n✅ Quote Result:');
    console.log(`  Success: ${result.success}`);
    if (result.success) {
      console.log(`  Output Amount: ${result.outputAmount} USDC`);
      console.log(`  Fee: ${result.feeAmount}`);
      console.log(`  Price Impact: ${result.priceImpact}`);
      console.log(`  Gas: ${result.gasEstimate}`);
      console.log(`  Route: ${result.route}`);
    } else {
      console.log(`  Error: ${result.error}`);
      console.log(`  User Message: ${result.userMessage}`);
    }
  } catch (error) {
    console.log(`\n❌ Test Failed: ${error.message}`);
    console.log(`  Stack: ${error.stack}`);
  }
  console.log('\n');
}

async function testGetQuoteForOrder() {
  console.log('📦 Test 2: getQuoteForOrder()');
  console.log('----------------------------');
  console.log('Testing: Prepare order for 10 ARB → USDC swap');

  try {
    const result = await getQuoteForOrder({
      fromTokenSymbol: 'ARB',
      toTokenSymbol: 'USDC',
      amount: '10',
      userAddress: '0x0000000000000000000000000000000000000000', // Dummy address for testing
      chainId: 42161,
      slippage: 0.005
    });

    console.log('\n✅ Order Quote Result:');
    console.log(`  Success: ${result.success}`);
    if (result.success) {
      console.log(`  Output Amount: ${result.quote.outputAmount} USDC`);
      console.log(`  Fee: ${result.quote.feeAmount}`);
      console.log(`  Price Impact: ${result.quote.priceImpact}`);
      console.log(`  Message: ${result.message}`);
      console.log(`  Has Order Params: ${!!result.orderParams}`);
      if (result.orderParams) {
        console.log(`  Order Kind: ${result.orderParams.kind}`);
        console.log(`  Sell Token: ${result.orderParams.sellToken}`);
        console.log(`  Buy Token: ${result.orderParams.buyToken}`);
        console.log(`  Amount: ${result.orderParams.amount}`);
        console.log(`  Valid For: ${result.orderParams.validFor} seconds`);
      }
    } else {
      console.log(`  Error: ${result.error}`);
      console.log(`  User Message: ${result.userMessage}`);
    }
  } catch (error) {
    console.log(`\n❌ Test Failed: ${error.message}`);
    console.log(`  Stack: ${error.stack}`);
  }
  console.log('\n');
}

async function runAllTests() {
  console.log('Starting tests...\n');

  await testGetQuote();
  await testGetQuoteForOrder();

  console.log('========================================');
  console.log('✅ All tests completed!');
  console.log('========================================');
}

// Run tests
runAllTests().catch(error => {
  console.error('\n❌ Fatal error running tests:');
  console.error(error);
  process.exit(1);
});
