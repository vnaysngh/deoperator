/**
 * CoW Protocol (CowSwap) Usage Example
 *
 * This file demonstrates how to use the CoW Protocol APIs for intent-based swaps.
 *
 * Example: Swap 10 ARB to USDC on Arbitrum
 */

import { getCowTokenPrice, getCowSwapQuote, createCowSwapOrder, submitCowSwapOrder } from './cowswap';

/**
 * Example 1: Get the USD price of a token
 *
 * Use case: User asks "What's the price of ARB?"
 */
async function example1_GetTokenPrice() {
  console.log('\n=== Example 1: Get Token Price ===');

  const result = await getCowTokenPrice('ARB', 42161); // Arbitrum chain

  if (result.success) {
    console.log(`ARB price: $${result.price} USD`);
  } else {
    console.error(`Error: ${result.userMessage}`);
  }
}

/**
 * Example 2: Get a quote for swapping tokens
 *
 * Use case: User asks "How much USDC will I get for 10 ARB?"
 */
async function example2_GetSwapQuote() {
  console.log('\n=== Example 2: Get Swap Quote ===');

  const result = await getCowSwapQuote(
    'ARB',        // From token
    'USDC',       // To token
    '10',         // Amount (10 ARB)
    undefined,    // User address (optional for quote)
    42161,        // Arbitrum chain
    0.005         // 0.5% slippage
  );

  if (result.success) {
    console.log('Quote Details:');
    console.log(`  Input: 10 ARB`);
    console.log(`  Output: ~${result.outputAmount} USDC`);
    console.log(`  Price Impact: ${result.priceImpact}`);
    console.log(`  Gas Estimate: ${result.gasEstimate}`);
    console.log(`  Route: ${result.route}`);
    console.log(`  Fee: ${result.feeAmount}`);
    console.log(`  Valid Until: ${new Date((result.validTo || 0) * 1000).toLocaleString()}`);
  } else {
    console.error(`Error: ${result.userMessage}`);
  }
}

/**
 * Example 3: Create an order (prepare for signing)
 *
 * Use case: User confirms "Yes, swap 10 ARB to USDC"
 *
 * Note: In a real application, this would be followed by:
 * 1. User signs the order using their wallet (EIP-712 signature)
 * 2. The signed order is submitted to CoW Protocol
 */
async function example3_CreateOrder() {
  console.log('\n=== Example 3: Create Order ===');

  const userAddress = '0x1234567890123456789012345678901234567890'; // Example address

  const result = await createCowSwapOrder(
    'ARB',          // From token
    'USDC',         // To token
    '10',           // Amount (10 ARB)
    userAddress,    // User's wallet address
    42161,          // Arbitrum chain
    0.005           // 0.5% slippage
  );

  if (result.success) {
    console.log('Order created successfully!');
    console.log(result.message);
    console.log('\nOrder Data (to be signed):');
    console.log(JSON.stringify(result.orderData, null, 2));
    console.log('\nNext steps:');
    console.log('1. Sign this order data using EIP-712 with the user\'s wallet');
    console.log('2. Submit the signed order using submitCowSwapOrder()');
  } else {
    console.error(`Error: ${result.userMessage}`);
  }
}

/**
 * Example 4: Complete workflow for swapping 10 ARB to USDC
 *
 * This demonstrates the full flow:
 * 1. Get a quote
 * 2. Show quote to user
 * 3. User confirms
 * 4. Create order
 * 5. Sign order (mock - would use wallet in real app)
 * 6. Submit order
 */
async function example4_CompleteSwapWorkflow() {
  console.log('\n=== Example 4: Complete Swap Workflow ===');
  console.log('User wants to: Swap 10 ARB to USDC on Arbitrum\n');

  const userAddress = '0x1234567890123456789012345678901234567890';

  // Step 1: Get quote
  console.log('Step 1: Getting quote...');
  const quote = await getCowSwapQuote('ARB', 'USDC', '10', userAddress, 42161, 0.005);

  if (!quote.success) {
    console.error(`Failed to get quote: ${quote.userMessage}`);
    return;
  }

  console.log('✓ Quote received');
  console.log(`  You will receive approximately ${quote.outputAmount} USDC`);
  console.log(`  Fee: ${quote.feeAmount}`);
  console.log(`  Price Impact: ${quote.priceImpact}`);

  // Step 2: User confirms (in a real app, user would click a button)
  console.log('\nStep 2: User confirms swap...');
  console.log('✓ User confirmed');

  // Step 3: Create order
  console.log('\nStep 3: Creating order...');
  const order = await createCowSwapOrder('ARB', 'USDC', '10', userAddress, 42161, 0.005);

  if (!order.success) {
    console.error(`Failed to create order: ${order.userMessage}`);
    return;
  }

  console.log('✓ Order created');

  // Step 4: Sign order (MOCK - in real app, this would use wagmi/viem to sign with user's wallet)
  console.log('\nStep 4: Signing order with user\'s wallet...');
  console.log('⚠️  [MOCK] In a real app, this would prompt the user\'s wallet to sign');
  const mockSignature = '0x' + '00'.repeat(65); // Mock signature

  // Step 5: Submit signed order
  console.log('\nStep 5: Submitting signed order to CoW Protocol...');
  console.log('⚠️  [MOCK] This would actually call the API with the signed order');

  // In a real implementation:
  // const signedOrder = {
  //   ...order.orderData,
  //   signature: mockSignature,
  //   signingScheme: 'eip712' as const,
  // };
  // const result = await submitCowSwapOrder(signedOrder, 42161);

  console.log('\n✓ Order submitted to CoW Protocol batch auction');
  console.log('✓ Your swap will be executed at the best available price');
  console.log('✓ You can monitor the order status in the CoW Protocol UI');
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  CoW Protocol (CowSwap) - Intent-Based Swap Examples        ║');
    console.log('║  Chain: Arbitrum (42161)                                     ║');
    console.log('║  Example: Swap 10 ARB to USDC                                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    await example1_GetTokenPrice();
    await example2_GetSwapQuote();
    await example3_CreateOrder();
    await example4_CompleteSwapWorkflow();

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  Examples completed!                                         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export for use in other files
export {
  example1_GetTokenPrice,
  example2_GetSwapQuote,
  example3_CreateOrder,
  example4_CompleteSwapWorkflow,
  runAllExamples,
};

// If running this file directly (e.g., with ts-node)
if (require.main === module) {
  runAllExamples();
}
