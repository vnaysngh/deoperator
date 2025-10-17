import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, UIMessage } from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const walletAddress = req.headers.get("x-wallet-address") || "";
  const positionsData = req.headers.get("x-positions-data") || "[]";

  console.log("[POSITIONS CHAT] Request:", {
    walletAddress,
    messageCount: messages.length,
  });

  try {
    const positions = JSON.parse(positionsData);

    // Build a comprehensive context about the user's positions
    const positionsContext = positions.length > 0
      ? `
USER'S DEFI POSITIONS DATA:

Total Positions: ${positions.length}
Total Protocols: ${new Set(positions.map((p: { protocol_id: string }) => p.protocol_id)).size}
Total Value: $${positions.reduce((sum: number, p: { position: { balance_usd: number | null } }) => sum + (p.position.balance_usd || 0), 0).toFixed(2)}

DETAILED BREAKDOWN:
${positions.map((pos: {
  protocol_name: string;
  protocol_id: string;
  position: {
    label: string;
    tokens: Array<{
      token_type: string;
      symbol: string;
      name: string;
      balance_formatted: string;
      usd_value?: number;
    }>;
    balance_usd: number | null;
    position_details?: Record<string, unknown>;
  };
}, idx: number) => `
Position ${idx + 1}:
- Protocol: ${pos.protocol_name} (${pos.protocol_id})
- Type: ${pos.position.label}
- Total Value: ${pos.position.balance_usd !== null ? `$${pos.position.balance_usd.toFixed(2)}` : 'N/A'}
- Assets:
${pos.position.tokens.filter((t: { token_type: string }) => t.token_type !== 'defi-token').map((token: {
  symbol: string;
  balance_formatted: string;
  usd_value?: number;
  token_type: string;
}) => `  * ${token.symbol}: ${parseFloat(token.balance_formatted).toFixed(6)} ${token.usd_value !== undefined ? `($${token.usd_value.toFixed(2)})` : ''} [${token.token_type === 'supplied' ? 'Deposited' : token.token_type === 'reward' ? 'Unclaimed Rewards' : token.token_type}]`).join('\n')}
${pos.position.position_details && Object.keys(pos.position.position_details).length > 0 ? `- Details:
${Object.entries(pos.position.position_details).filter(([key]) => !['reserve0', 'reserve1', 'factory', 'pair'].includes(key)).map(([key, value]) => `  * ${key.replace(/_/g, ' ')}: ${typeof value === 'number' ? value.toFixed(2) : String(value)}`).join('\n')}` : ''}
`).join('\n')}
`
      : "No DeFi positions found for this wallet.";

    const result = streamText({
      model: openai("gpt-4-turbo"),
      messages: convertToModelMessages(messages),
      system: `You are a helpful DeFi positions intelligence assistant. You help users understand their DeFi portfolio, including liquidity positions, staking, lending/borrowing, and other DeFi activities.

${walletAddress ? `Connected Wallet: ${walletAddress}` : "No wallet connected"}

${positionsContext}

Your role:
1. EXPLAIN POSITIONS: Help users understand what their positions mean in simple terms
2. RISK ASSESSMENT: Explain risks like impermanent loss, liquidation risk, smart contract risk
3. PERFORMANCE INSIGHTS: Help interpret metrics like APY, APR, pool share, health factor
4. EDUCATIONAL: Explain DeFi concepts in the easiest language possible
5. ACTIONABLE ADVICE: Provide context-aware suggestions based on their actual positions

Key DeFi Concepts to Explain Simply:
- Liquidity Position: You've deposited two tokens into a pool to help others trade. You earn fees but face impermanent loss.
- Staking: You've locked tokens to support the network and earn rewards.
- Lending/Borrowing (Aave, Compound): You've supplied tokens to earn interest, or borrowed against your deposits.
- APY (Annual Percentage Yield): How much you earn in a year, compounding included.
- APR (Annual Percentage Rate): Similar to APY but without compounding.
- Impermanent Loss: When token prices change, you might have less value than just holding the tokens.
- Health Factor: For lending protocols, this shows how safe your borrowed position is. Below 1.0 means liquidation risk.
- Pool Share: Your percentage of the total liquidity pool.
- Leverage: Borrowing to increase your position size, amplifying both gains and losses.

Response Guidelines:
- ALWAYS use simple, conversational language
- Avoid jargon unless explaining it
- Use analogies and examples
- Be specific to their actual positions
- Highlight important risks they should know
- If they ask "what does X mean", explain it in the context of their positions
- Break down complex positions step-by-step
- Use numbers from their actual positions to make it real
- If asking about performance, calculate based on their data

Example Responses:
User: "What is my liquidity position?"
You: "You have a liquidity position in the ETH/USDC pool on Uniswap worth $1,200. This means you've deposited both ETH and USDC to help people trade between these tokens. In return, you earn a small fee every time someone makes a swap. The main risk here is 'impermanent loss' - if ETH's price changes significantly compared to USDC, you might end up with less value than if you just held the tokens separately."

User: "What does APY mean?"
You: "APY stands for Annual Percentage Yield - it's how much profit you'd make in a year. Looking at your Aave position earning 0.19% APY on WETH, that means if you keep your 0.052 WETH deposited for a year, you'd earn about $0.38 in interest (based on current rates). It's like a savings account, but for crypto!"

Be helpful, clear, and always put the user's understanding first.`,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[POSITIONS CHAT] Error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
