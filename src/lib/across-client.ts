import { AcrossClient, type Quote } from "@across-protocol/app-sdk";
import { arbitrum, base, mainnet } from "viem/chains";
import { Address, Hex, formatUnits, parseUnits } from "viem";
import { getChainName } from "./chains";

const ACROSS_INTEGRATOR_ID = "0x00a4" as Hex;

export const SUPPORTED_BRIDGE_CHAIN_IDS = [mainnet.id, arbitrum.id, base.id] as const;

export const SUPPORTED_BRIDGE_TOKENS = ["ETH", "USDC", "USDT", "DAI"] as const;

type SupportedBridgeToken = (typeof SUPPORTED_BRIDGE_TOKENS)[number];
type SupportedBridgeChainId = (typeof SUPPORTED_BRIDGE_CHAIN_IDS)[number];

type BridgeTokenConfig = {
  address: Address;
  decimals: number;
  symbol: SupportedBridgeToken;
  isNative?: boolean;
};

const toLower = (address: string): Address =>
  address.toLowerCase() as Address;

const TOKEN_CONFIG: Record<
  SupportedBridgeChainId,
  Record<SupportedBridgeToken, BridgeTokenConfig>
> = {
  [mainnet.id]: {
    ETH: {
      address: toLower("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
      decimals: 18,
      symbol: "ETH",
      isNative: true
    },
    USDC: {
      address: toLower("0xA0b86991c6218B36C1d19D4a2e9Eb0cE3606eB48"),
      decimals: 6,
      symbol: "USDC"
    },
    USDT: {
      address: toLower("0xdAC17F958D2ee523a2206206994597C13D831ec7"),
      decimals: 6,
      symbol: "USDT"
    },
    DAI: {
      address: toLower("0x6B175474E89094C44Da98b954EedeAC495271d0F"),
      decimals: 18,
      symbol: "DAI"
    }
  },
  [arbitrum.id]: {
    ETH: {
      address: toLower("0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"),
      decimals: 18,
      symbol: "ETH",
      isNative: true
    },
    USDC: {
      address: toLower("0xaf88d065e77c8cC2239327C5EDb3A432268e5831"),
      decimals: 6,
      symbol: "USDC"
    },
    USDT: {
      address: toLower("0xfd086bc7Cd5C481DCC9C85ebe478A1C0b69FCbb9"),
      decimals: 6,
      symbol: "USDT"
    },
    DAI: {
      address: toLower("0xda10009cBd5D07dd0CeCc66161FC93D7c9000da1"),
      decimals: 18,
      symbol: "DAI"
    }
  },
  [base.id]: {
    ETH: {
      address: toLower("0x4200000000000000000000000000000000000006"),
      decimals: 18,
      symbol: "ETH",
      isNative: true
    },
    USDC: {
      address: toLower("0x833589fCD6eDb6E08f4C7C32D4f71b54bDa02913"),
      decimals: 6,
      symbol: "USDC"
    },
    USDT: {
      address: toLower("0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2"),
      decimals: 6,
      symbol: "USDT"
    },
    DAI: {
      address: toLower("0x50C5725949A6F0c72E6C4a641F24049A917DB0Cb"),
      decimals: 18,
      symbol: "DAI"
    }
  }
};

let acrossClient: AcrossClient | null = null;

export function getAcrossClient(): AcrossClient {
  if (!acrossClient) {
    acrossClient = AcrossClient.create({
      integratorId: ACROSS_INTEGRATOR_ID,
      chains: [mainnet, arbitrum, base]
    });
  }
  return acrossClient;
}

type FeeBreakdown = {
  amountWei: string;
  amountFormatted: string;
  percentage: number;
};

type SerializedDeposit = {
  inputAmount: string;
  outputAmount: string;
  recipient: Address;
  message: Hex;
  quoteTimestamp: number;
  fillDeadline: number;
  exclusiveRelayer: Address;
  exclusivityDeadline: number;
  spokePoolAddress: Address;
  destinationSpokePoolAddress: Address;
  originChainId: number;
  destinationChainId: number;
  inputToken: Address;
  outputToken: Address;
  isNative?: boolean;
};

export type SerializedBridgeQuote = {
  needsClientBridge: true;
  originChainId: number;
  originChainLabel: string;
  destinationChainId: number;
  destinationChainLabel: string;
  tokenSymbol: SupportedBridgeToken;
  tokenDecimals: number;
  tokenAddress: Address;
  destinationTokenAddress: Address;
  isNative: boolean;
  requestedAmount: string;
  inputAmountWei: string;
  inputAmountFormatted: string;
  outputAmountWei: string;
  outputAmountFormatted: string;
  estimatedFillTimeSec: number;
  estimatedFillTimeFormatted: string;
  totalFee: FeeBreakdown;
  relayerGasFee: FeeBreakdown;
  relayerCapitalFee: FeeBreakdown;
  limits: {
    minDepositWei: string;
    minDepositFormatted: string;
    maxDepositWei: string;
    maxDepositFormatted: string;
  };
  deposit: SerializedDeposit;
  quoteTimestamp: number;
  isAmountTooLow: boolean;
};

export function deserializeBridgeDeposit(serialized: SerializedDeposit): Quote["deposit"] {
  return {
    inputAmount: BigInt(serialized.inputAmount),
    outputAmount: BigInt(serialized.outputAmount),
    recipient: serialized.recipient,
    message: serialized.message,
    quoteTimestamp: serialized.quoteTimestamp,
    fillDeadline: serialized.fillDeadline,
    exclusiveRelayer: serialized.exclusiveRelayer,
    exclusivityDeadline: serialized.exclusivityDeadline,
    spokePoolAddress: serialized.spokePoolAddress,
    destinationSpokePoolAddress: serialized.destinationSpokePoolAddress,
    originChainId: serialized.originChainId,
    destinationChainId: serialized.destinationChainId,
    inputToken: serialized.inputToken,
    outputToken: serialized.outputToken,
    isNative: serialized.isNative
  };
}

function serializeDeposit(deposit: Quote["deposit"]): SerializedDeposit {
  return {
    inputAmount: deposit.inputAmount.toString(),
    outputAmount: deposit.outputAmount.toString(),
    recipient: deposit.recipient,
    message: deposit.message,
    quoteTimestamp: deposit.quoteTimestamp,
    fillDeadline: deposit.fillDeadline,
    exclusiveRelayer: deposit.exclusiveRelayer,
    exclusivityDeadline: deposit.exclusivityDeadline,
    spokePoolAddress: deposit.spokePoolAddress,
    destinationSpokePoolAddress: deposit.destinationSpokePoolAddress,
    originChainId: deposit.originChainId,
    destinationChainId: deposit.destinationChainId,
    inputToken: deposit.inputToken,
    outputToken: deposit.outputToken,
    isNative: deposit.isNative
  };
}

function getTokenConfig(
  chainId: number,
  symbol: string
): BridgeTokenConfig | null {
  const upper = symbol.toUpperCase() as SupportedBridgeToken;
  if (!SUPPORTED_BRIDGE_TOKENS.includes(upper)) {
    return null;
  }

  if (!SUPPORTED_BRIDGE_CHAIN_IDS.includes(chainId as SupportedBridgeChainId)) {
    return null;
  }

  return TOKEN_CONFIG[chainId as SupportedBridgeChainId][upper];
}

function formatTokenAmountHuman(value: bigint, decimals: number): string {
  const human = Number(formatUnits(value, decimals));
  return human.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  });
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "a few minutes";
  }

  if (seconds < 60) {
    return `${Math.max(1, Math.round(seconds))} seconds`;
  }

  const minutes = seconds / 60;
  if (minutes < 60) {
    return `${Math.round(minutes)} minute${Math.round(minutes) === 1 ? "" : "s"}`;
  }

  const hours = minutes / 60;
  if (hours < 24) {
    return `${hours.toFixed(1)} hour${hours >= 2 ? "s" : ""}`;
  }

  const days = hours / 24;
  return `${days.toFixed(1)} day${days >= 2 ? "s" : ""}`;
}

function calculateFeeBreakdown(
  feeTotal: bigint,
  inputAmount: bigint,
  decimals: number
): FeeBreakdown {
  const amountFormatted = formatTokenAmountHuman(feeTotal, decimals);

  const percentage =
    inputAmount === BigInt(0)
      ? 0
      : Number((feeTotal * BigInt(1000000)) / inputAmount) / 10000;

  return {
    amountWei: feeTotal.toString(),
    amountFormatted,
    percentage
  };
}

export type BridgeQuoteResult =
  | {
      success: true;
      message: string;
      bridgeQuote: SerializedBridgeQuote;
    }
  | {
      success: false;
      userMessage: string;
      error?: string;
    };

export async function getAcrossBridgeQuote(params: {
  originChainId: number;
  destinationChainId: number;
  tokenSymbol: string;
  amount: string;
}): Promise<BridgeQuoteResult> {
  const { originChainId, destinationChainId, tokenSymbol, amount } = params;

  if (originChainId === destinationChainId) {
    return {
      success: false,
      userMessage: "You’re already on that network. Pick a different destination chain to bridge."
    };
  }

  if (
    !SUPPORTED_BRIDGE_CHAIN_IDS.includes(
      originChainId as SupportedBridgeChainId
    ) ||
    !SUPPORTED_BRIDGE_CHAIN_IDS.includes(
      destinationChainId as SupportedBridgeChainId
    )
  ) {
    return {
      success: false,
      userMessage:
        "Across is available on Ethereum, Arbitrum, and Base right now. Choose one of those networks for bridging."
    };
  }

  const upperSymbol = tokenSymbol.trim().toUpperCase();

  if (!SUPPORTED_BRIDGE_TOKENS.includes(upperSymbol as SupportedBridgeToken)) {
    return {
      success: false,
      userMessage:
        "Across currently supports bridging ETH, USDC, USDT, and DAI here. Try one of those tokens."
    };
  }

  const originToken = getTokenConfig(originChainId, upperSymbol);
  const destinationToken = getTokenConfig(destinationChainId, upperSymbol);

  if (!originToken || !destinationToken) {
    return {
      success: false,
      userMessage:
        "That token isn’t supported on one of the selected chains. Pick another supported chain/token pair."
    };
  }

  let amountWei: bigint;
  try {
    amountWei = parseUnits(amount, originToken.decimals);
  } catch {
    return {
      success: false,
      userMessage:
        "I need a numeric amount to bridge. Try something like 25 or 100.5."
    };
  }

  if (amountWei <= BigInt(0)) {
    return {
      success: false,
      userMessage: "Enter an amount greater than zero to bridge."
    };
  }

  try {
    const client = getAcrossClient();
    const quote = await client.getQuote({
      route: {
        originChainId,
        destinationChainId,
        inputToken: originToken.address,
        outputToken: destinationToken.address,
        isNative: originToken.isNative ?? false
      },
      inputAmount: amountWei.toString()
    });

    const inputAmountFormatted = formatTokenAmountHuman(
      quote.deposit.inputAmount,
      originToken.decimals
    );

    const outputAmountFormatted = formatTokenAmountHuman(
      quote.deposit.outputAmount,
      destinationToken.decimals
    );

    const totalFeeAmount = quote.fees.totalRelayFee.total;

    const totalFee = calculateFeeBreakdown(
      totalFeeAmount,
      quote.deposit.inputAmount,
      originToken.decimals
    );

    const relayerGasFee = calculateFeeBreakdown(
      quote.fees.relayerGasFee.total,
      quote.deposit.inputAmount,
      originToken.decimals
    );

    const relayerCapitalFee = calculateFeeBreakdown(
      quote.fees.relayerCapitalFee.total,
      quote.deposit.inputAmount,
      originToken.decimals
    );

    const estimatedFillTimeFormatted = formatDuration(
      quote.estimatedFillTimeSec
    );

    const limits = {
      minDepositWei: quote.limits.minDeposit.toString(),
      minDepositFormatted: formatTokenAmountHuman(
        quote.limits.minDeposit,
        originToken.decimals
      ),
      maxDepositWei: quote.limits.maxDeposit.toString(),
      maxDepositFormatted: formatTokenAmountHuman(
        quote.limits.maxDeposit,
        originToken.decimals
      )
    };

    const originChainLabel = getChainName(originChainId);
    const destinationChainLabel = getChainName(destinationChainId);

    const bridgeQuote: SerializedBridgeQuote = {
      needsClientBridge: true,
      originChainId,
      originChainLabel,
      destinationChainId,
      destinationChainLabel,
      tokenSymbol: originToken.symbol,
      tokenDecimals: originToken.decimals,
      tokenAddress: originToken.address,
      destinationTokenAddress: destinationToken.address,
      isNative: Boolean(originToken.isNative),
      requestedAmount: amount,
      inputAmountWei: quote.deposit.inputAmount.toString(),
      inputAmountFormatted,
      outputAmountWei: quote.deposit.outputAmount.toString(),
      outputAmountFormatted,
      estimatedFillTimeSec: quote.estimatedFillTimeSec,
      estimatedFillTimeFormatted,
      totalFee,
      relayerGasFee,
      relayerCapitalFee,
      limits,
      deposit: serializeDeposit(quote.deposit),
      quoteTimestamp: quote.deposit.quoteTimestamp,
      isAmountTooLow: quote.isAmountTooLow
    };

    const messageParts: string[] = [
      `Ready to bridge ${inputAmountFormatted} ${originToken.symbol} from ${originChainLabel} to ${destinationChainLabel}.`,
      `You’ll receive about ${outputAmountFormatted} ${destinationToken.symbol} after fees.`,
      `Estimated fill time: ${estimatedFillTimeFormatted}.`
    ];

    if (quote.isAmountTooLow) {
      messageParts.push(
        `Heads up: Across recommends at least ${limits.minDepositFormatted} ${originToken.symbol} for this route.`
      );
    }

    const message = messageParts.join(" ");

    return {
      success: true,
      message,
      bridgeQuote
    };
  } catch (error) {
    console.error("[ACROSS] Failed to fetch bridge quote:", error);
    return {
      success: false,
      userMessage:
        "Across couldn’t produce a quote for that route right now. Try a smaller amount or a different pair.",
      error: error instanceof Error ? error.message : "UNKNOWN_ERROR"
    };
  }
}
