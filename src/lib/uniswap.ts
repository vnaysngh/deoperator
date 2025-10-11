import { ethers } from "ethers";
import { CurrencyAmount, TradeType, Percent } from "@uniswap/sdk-core";
import { AlphaRouter, SwapType } from "@uniswap/smart-order-router";
import { getTokenBySymbol } from "./tokens";

const UNISWAP_V3_SWAP_ROUTER_ADDRESS =
  "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
  "function balanceOf(address account) public view returns (uint256)"
];

const SWAP_ROUTER_ABI = [
  "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)"
];

export interface SwapQuote {
  inputAmount: string;
  outputAmount: string;
  priceImpact: string;
  gasEstimate: string;
  route: string[];
}

export async function getSwapQuote(
  fromTokenSymbol: string,
  toTokenSymbol: string,
  amount: string,
  chainId: number = 1
): Promise<SwapQuote> {
  try {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
    if (!rpcUrl) {
      throw new Error("RPC URL not configured");
    }

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const fromToken = await getTokenBySymbol(fromTokenSymbol, chainId);
    const toToken = await getTokenBySymbol(toTokenSymbol, chainId);

    if (!fromToken || !toToken) {
      throw new Error("Token not found");
    }

    const router = new AlphaRouter({
      chainId,
      provider
    });

    const amountIn = ethers.utils.parseUnits(amount, fromToken.decimals);
    const currencyAmount = CurrencyAmount.fromRawAmount(
      fromToken,
      amountIn.toString()
    );

    const route = await router.route(
      currencyAmount,
      toToken,
      TradeType.EXACT_INPUT,
      {
        type: SwapType.SWAP_ROUTER_02,
        recipient: ethers.constants.AddressZero, // Placeholder
        slippageTolerance: new Percent(50, 10_000), // 0.5%
        deadline: Math.floor(Date.now() / 1000 + 1800) // 30 minutes
      }
    );

    if (!route) {
      throw new Error("No route found");
    }

    return {
      inputAmount: amount,
      outputAmount: route.quote.toFixed(toToken.decimals),
      priceImpact: route.estimatedGasUsedUSD.toFixed(2),
      gasEstimate: route.estimatedGasUsed.toString(),
      route: [fromTokenSymbol, toTokenSymbol]
    };
  } catch (error) {
    console.error("Error getting swap quote:", error);
    throw error;
  }
}

export async function executeSwap(
  fromTokenSymbol: string,
  toTokenSymbol: string,
  amount: string,
  walletAddress: string,
  signer: ethers.Signer,
  slippageTolerance: number = 0.5,
  chainId: number = 1
): Promise<ethers.providers.TransactionReceipt> {
  try {
    const fromToken = await getTokenBySymbol(fromTokenSymbol, chainId);
    const toToken = await getTokenBySymbol(toTokenSymbol, chainId);

    if (!fromToken || !toToken) {
      throw new Error("Token not found");
    }

    const amountIn = ethers.utils.parseUnits(amount, fromToken.decimals);

    // Check allowance
    const tokenContract = new ethers.Contract(
      fromToken.address,
      ERC20_ABI,
      signer
    );
    const allowance = await tokenContract.allowance(
      walletAddress,
      UNISWAP_V3_SWAP_ROUTER_ADDRESS
    );

    // Approve if needed
    if (allowance.lt(amountIn)) {
      console.log("Approving token...");
      const approveTx = await tokenContract.approve(
        UNISWAP_V3_SWAP_ROUTER_ADDRESS,
        amountIn
      );
      await approveTx.wait();
      console.log("Token approved");
    }

    console.log(fromTokenSymbol, toTokenSymbol, amount, chainId, "dd");

    // Get quote for minimum output
    const quote = await getSwapQuote(
      fromTokenSymbol,
      toTokenSymbol,
      amount,
      chainId
    );
    const minOutputAmount = ethers.utils.parseUnits(
      (parseFloat(quote.outputAmount) * (1 - slippageTolerance / 100)).toFixed(
        toToken.decimals
      ),
      toToken.decimals
    );

    // Execute swap
    const swapRouter = new ethers.Contract(
      UNISWAP_V3_SWAP_ROUTER_ADDRESS,
      SWAP_ROUTER_ABI,
      signer
    );

    const params = {
      tokenIn: fromToken.address,
      tokenOut: toToken.address,
      fee: 3000, // 0.3% fee tier
      recipient: walletAddress,
      amountIn: amountIn,
      amountOutMinimum: minOutputAmount,
      sqrtPriceLimitX96: 0
    };

    const tx = await swapRouter.exactInputSingle(params);
    const receipt = await tx.wait();

    return receipt;
  } catch (error) {
    console.error("Error executing swap:", error);
    throw error;
  }
}

export async function getTokenBalance(
  tokenSymbol: string,
  walletAddress: string,
  provider: ethers.providers.Provider,
  chainId: number = 1
): Promise<string> {
  try {
    const token = await getTokenBySymbol(tokenSymbol, chainId);

    if (!token) {
      throw new Error("Token not found");
    }

    const tokenContract = new ethers.Contract(
      token.address,
      ERC20_ABI,
      provider
    );
    const balance = await tokenContract.balanceOf(walletAddress);

    return ethers.utils.formatUnits(balance, token.decimals);
  } catch (error) {
    console.error("Error getting token balance:", error);
    throw error;
  }
}
