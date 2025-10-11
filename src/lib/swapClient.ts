import { ethers } from 'ethers'
import { getTokenBySymbol } from './tokens'

const UNISWAP_V3_SWAP_ROUTER_ADDRESS = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function allowance(address owner, address spender) public view returns (uint256)',
]

const SWAP_ROUTER_ABI = [
  'function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
]

export async function executeSwapClient(
  fromTokenSymbol: string,
  toTokenSymbol: string,
  amount: string,
  expectedOutput: string,
  walletAddress: string,
  signer: ethers.Signer,
  slippageTolerance: number = 0.5,
  chainId: number = 1
): Promise<ethers.providers.TransactionReceipt> {
  const fromToken = await getTokenBySymbol(fromTokenSymbol, chainId)
  const toToken = await getTokenBySymbol(toTokenSymbol, chainId)

  if (!fromToken || !toToken) {
    throw new Error('Token not found')
  }

  const amountIn = ethers.utils.parseUnits(amount, fromToken.decimals)

  // Check allowance
  const tokenContract = new ethers.Contract(fromToken.address, ERC20_ABI, signer)
  const allowance = await tokenContract.allowance(walletAddress, UNISWAP_V3_SWAP_ROUTER_ADDRESS)

  // Approve if needed
  if (allowance.lt(amountIn)) {
    console.log('Approving token...')
    const approveTx = await tokenContract.approve(UNISWAP_V3_SWAP_ROUTER_ADDRESS, amountIn)
    await approveTx.wait()
    console.log('Token approved')
  }

  // Calculate minimum output with slippage
  const minOutputAmount = ethers.utils.parseUnits(
    (parseFloat(expectedOutput) * (1 - slippageTolerance / 100)).toFixed(toToken.decimals),
    toToken.decimals
  )

  // Execute swap
  const swapRouter = new ethers.Contract(UNISWAP_V3_SWAP_ROUTER_ADDRESS, SWAP_ROUTER_ABI, signer)

  const params = {
    tokenIn: fromToken.address,
    tokenOut: toToken.address,
    fee: 3000, // 0.3% fee tier
    recipient: walletAddress,
    amountIn: amountIn,
    amountOutMinimum: minOutputAmount,
    sqrtPriceLimitX96: 0,
  }

  const tx = await swapRouter.exactInputSingle(params)
  const receipt = await tx.wait()

  return receipt
}
