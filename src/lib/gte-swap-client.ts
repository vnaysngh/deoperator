/**
 * Client-side GTE SDK for MegaETH Testnet Swaps
 *
 * This handles all swap operations on MegaETH testnet using the GTE SDK.
 * All quote fetching, transaction building, and submission happens CLIENT-SIDE.
 *
 * SDK Docs: https://github.com/vnaysngh/gte-typescript-sdk
 */

import { getGteSdk } from "./gte-sdk";
import { megaethTestnet } from "@reown/appkit/networks";
import type {
  Address,
  PublicClient,
  WalletClient,
  Hex
} from "viem";

export interface GteSwapQuote {
  amountIn: string;
  amountInAtomic: bigint;
  expectedAmountOut: string;
  expectedAmountOutAtomic: bigint;
  minAmountOut: string;
  minAmountOutAtomic: bigint;
  price: string;
  slippageBps: number;
  path: Address[];
  // Additional fields for UI
  tokenIn: {
    address: Address;
    symbol: string;
    name: string;
    decimals: number;
  };
  tokenOut: {
    address: Address;
    symbol: string;
    name: string;
    decimals: number;
  };
}

export interface GetGteQuoteParams {
  sellToken: Address;
  buyToken: Address;
  sellAmount: string;
  sellDecimals: number;
  buyDecimals: number;
  sellSymbol: string;
  buySymbol: string;
  slippageBps?: number;
}

/**
 * Get a swap quote from GTE SDK
 */
export async function getGteSwapQuote(
  params: GetGteQuoteParams
): Promise<GteSwapQuote> {
  console.log("[GTE CLIENT] Getting quote...", {
    sellToken: params.sellToken,
    buyToken: params.buyToken,
    sellAmount: params.sellAmount
  });

  const sdk = getGteSdk();

  // Prepare token objects for SDK
  const tokenIn = {
    address: params.sellToken,
    symbol: params.sellSymbol,
    name: params.sellSymbol, // Use symbol as name
    decimals: params.sellDecimals
  };

  const tokenOut = {
    address: params.buyToken,
    symbol: params.buySymbol,
    name: params.buySymbol, // Use symbol as name
    decimals: params.buyDecimals
  };

  // Get quote from SDK
  const quote = await sdk.getQuote({
    tokenIn,
    tokenOut,
    amountIn: params.sellAmount,
    slippageBps: params.slippageBps || 50 // 0.5% default
  });

  console.log("[GTE CLIENT] Quote received:", quote);

  return {
    ...quote,
    tokenIn,
    tokenOut
  };
}

export interface SubmitGteSwapParams {
  quote: GteSwapQuote;
  userAddress: Address;
  publicClient: PublicClient;
  walletClient: WalletClient;
  useNativeIn?: boolean;
  useNativeOut?: boolean;
}

/**
 * Submit a swap on MegaETH using GTE SDK
 * Returns the transaction hash
 */
export async function submitGteSwap(
  params: SubmitGteSwapParams
): Promise<{ txHash: Hex }> {
  console.log("[GTE CLIENT] Submitting swap...");

  const sdk = getGteSdk();

  // Build the swap transaction
  const { tx, deadline } = await sdk.buildSwapExactIn({
    tokenIn: params.quote.tokenIn,
    tokenOut: params.quote.tokenOut,
    amountIn: params.quote.amountIn,
    recipient: params.userAddress,
    quote: params.quote,
    useNativeIn: params.useNativeIn,
    useNativeOut: params.useNativeOut,
    deadlineSeconds: 20 * 60 // 20 minutes
  });

  console.log("[GTE CLIENT] Swap transaction built:", {
    to: tx.to,
    value: tx.value,
    deadline
  });

  // Send the transaction via wallet (use MegaETH chain explicitly)
  const txHash = await params.walletClient.sendTransaction({
    to: tx.to as Address,
    data: tx.data,
    value: tx.value,
    chain: megaethTestnet,
    account: params.userAddress
  });

  console.log("[GTE CLIENT] Transaction sent:", txHash);

  // Wait for confirmation
  await params.publicClient.waitForTransactionReceipt({
    hash: txHash
  });

  console.log("[GTE CLIENT] Transaction confirmed!");

  return { txHash };
}

export interface GetGteAllowanceParams {
  tokenAddress: Address;
  userAddress: Address;
  publicClient: PublicClient;
}

/**
 * Check token allowance for GTE router
 */
export async function getGteAllowance(
  params: GetGteAllowanceParams
): Promise<bigint> {
  console.log("[GTE CLIENT] Checking allowance...", {
    token: params.tokenAddress,
    user: params.userAddress
  });

  const sdk = getGteSdk();
  const config = sdk.getChainConfig();

  // Get the Uniswap router address that GTE uses
  const spenderAddress = await params.publicClient.readContract({
    address: config.routerAddress as Address,
    abi: [
      {
        type: "function",
        name: "uniV2Router",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "router", type: "address" }]
      }
    ],
    functionName: "uniV2Router",
    args: []
  });

  // Check ERC20 allowance
  const allowance = await params.publicClient.readContract({
    address: params.tokenAddress,
    abi: [
      {
        type: "function",
        name: "allowance",
        stateMutability: "view",
        inputs: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" }
        ],
        outputs: [{ name: "", type: "uint256" }]
      }
    ],
    functionName: "allowance",
    args: [params.userAddress, spenderAddress as Address]
  });

  console.log("[GTE CLIENT] Allowance:", allowance);
  return allowance;
}

export interface ApproveGteParams {
  tokenAddress: Address;
  userAddress: Address;
  amount?: bigint; // If not provided, approves max
  publicClient: PublicClient;
  walletClient: WalletClient;
}

/**
 * Approve tokens for GTE router
 */
export async function approveGte(
  params: ApproveGteParams
): Promise<{ txHash: Hex }> {
  console.log("[GTE CLIENT] Approving tokens...", {
    token: params.tokenAddress,
    amount: params.amount?.toString() || "MAX"
  });

  const sdk = getGteSdk();

  // Build approval transaction
  const approveTx = await sdk.buildApprove({
    tokenAddress: params.tokenAddress,
    amount: params.amount // SDK defaults to max if not provided
  });

  console.log("[GTE CLIENT] Approval transaction built");

  // Send the transaction (use MegaETH chain explicitly)
  const txHash = await params.walletClient.sendTransaction({
    to: approveTx.to as Address,
    data: approveTx.data,
    value: approveTx.value,
    chain: megaethTestnet,
    account: params.userAddress
  });

  console.log("[GTE CLIENT] Approval sent:", txHash);

  // Wait for confirmation
  await params.publicClient.waitForTransactionReceipt({
    hash: txHash
  });

  console.log("[GTE CLIENT] Approval confirmed!");

  return { txHash };
}

/**
 * Helper to check if token needs approval
 */
export async function needsApproval(
  tokenAddress: Address,
  userAddress: Address,
  amount: bigint,
  publicClient: PublicClient
): Promise<boolean> {
  const allowance = await getGteAllowance({
    tokenAddress,
    userAddress,
    publicClient
  });

  return allowance < amount;
}
