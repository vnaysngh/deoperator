import { google } from "@ai-sdk/google";
// import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, UIMessage } from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const walletAddress = req.headers.get("x-wallet-address") || "";
  const transactionsData = req.headers.get("x-transactions-data") || "[]";

  console.log("[TRANSACTIONS CHAT] Request:", {
    walletAddress,
    messageCount: messages.length
  });

  try {
    const transactions = JSON.parse(transactionsData);

    // Build comprehensive context about transactions
    const transactionsContext =
      transactions.length > 0
        ? `
USER'S TRANSACTION HISTORY DATA:

Total Transactions: ${transactions.length}
Wallet Address: ${walletAddress}

TRANSACTION BREAKDOWN:
${transactions
  .map(
    (
      tx: {
        hash: string;
        from_address: string;
        from_address_label: string | null;
        to_address: string;
        to_address_label: string | null;
        value: string;
        gas: string;
        gas_price: string;
        receipt_gas_used: string;
        receipt_status: string;
        block_timestamp: string;
        block_number: string;
      },
      idx: number
    ) => {
      const ethValue = (parseFloat(tx.value) / 1e18).toFixed(6);
      const gasUsed = parseInt(tx.receipt_gas_used);
      const gasPrice = parseFloat(tx.gas_price) / 1e9; // Convert to Gwei
      const gasFee = ((gasUsed * gasPrice) / 1e9).toFixed(6); // Convert to ETH
      const date = new Date(tx.block_timestamp);
      const isFromUser =
        tx.from_address.toLowerCase() === walletAddress.toLowerCase();

      return `
Transaction ${idx + 1}:
- Type: ${isFromUser ? "SENT" : "RECEIVED"}
- Hash: ${tx.hash}
- Date: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}
- From: ${tx.from_address_label || tx.from_address}
- To: ${
        tx.to_address
          ? tx.to_address_label || tx.to_address
          : "Contract Creation"
      }
- Amount: ${ethValue} ETH
- Gas Used: ${gasUsed.toLocaleString()}
- Gas Price: ${gasPrice.toFixed(2)} Gwei
- Gas Fee: ${gasFee} ETH
- Status: ${tx.receipt_status === "1" ? "SUCCESS" : "FAILED"}
- Block: ${tx.block_number}
`;
    }
  )
  .join("\n")}

SUMMARY STATISTICS:
- Total Sent: ${
            transactions.filter(
              (tx: { from_address: string }) =>
                tx.from_address.toLowerCase() === walletAddress.toLowerCase()
            ).length
          }
- Total Received: ${
            transactions.filter(
              (tx: { from_address: string }) =>
                tx.from_address.toLowerCase() !== walletAddress.toLowerCase()
            ).length
          }
- Failed Transactions: ${
            transactions.filter(
              (tx: { receipt_status: string }) => tx.receipt_status !== "1"
            ).length
          }
- Total ETH Transacted: ${transactions
            .reduce(
              (sum: number, tx: { value: string }) =>
                sum + parseFloat(tx.value) / 1e18,
              0
            )
            .toFixed(6)} ETH
- Total Gas Spent: ${transactions
            .reduce(
              (
                sum: number,
                tx: { receipt_gas_used: string; gas_price: string }
              ) => {
                const gasUsed = parseInt(tx.receipt_gas_used);
                const gasPrice = parseFloat(tx.gas_price) / 1e9;
                return sum + (gasUsed * gasPrice) / 1e9;
              },
              0
            )
            .toFixed(6)} ETH
`
        : "No transactions found for this wallet.";

    const result = streamText({
      model: google("gemini-2.5-flash"),
      messages: convertToModelMessages(messages),
      system: `You are a helpful blockchain transaction intelligence assistant. You help users understand their on-chain transaction history, gas fees, transaction types, and blockchain concepts.

${walletAddress ? `Connected Wallet: ${walletAddress}` : "No wallet connected"}

${transactionsContext}

Your role:
1. EXPLAIN TRANSACTIONS: Help users understand what each transaction represents in simple terms
2. GAS FEE INSIGHTS: Explain gas fees, when to transact, and how to optimize costs
3. TRANSACTION TYPES: Explain sends, receives, contract interactions, token swaps, etc.
4. TROUBLESHOOTING: Help understand why transactions fail and what to do
5. SECURITY AWARENESS: Point out suspicious patterns or potential security issues
6. EDUCATIONAL: Explain blockchain concepts in the easiest language possible

Key Blockchain Concepts to Explain Simply:
- Transaction Hash: A unique identifier for a transaction, like a receipt number
- Gas Fees: Payment to miners/validators for processing your transaction. Like a service fee.
- Gwei: A unit for measuring gas price. 1 ETH = 1 billion Gwei
- Block Number: Transactions are grouped into blocks. Like pages in a ledger.
- Block Confirmation: How many blocks have been added since your transaction. More confirmations = more secure.
- Failed Transaction: Transaction was rejected by the network, but you still paid gas fees
- Contract Interaction: When you interact with a smart contract (DeFi, NFTs, etc.)
- Transfer vs Contract: Transfers are simple sends. Contract interactions do more complex things.
- Nonce: Transaction count for your wallet. Ensures transactions happen in order.

Gas Fee Optimization:
- Gas prices vary by network congestion
- Early morning/late night often has lower fees
- Use gas trackers to find optimal times
- Failed transactions still cost gas (explain why this happens)

Transaction Patterns to Watch:
- Frequent small transactions (might be inefficient)
- Unusual destinations (potential scams)
- Failed transactions (investigate why)
- High gas fees (timing or urgent transactions)

Response Guidelines:
- ALWAYS use simple, conversational language
- Avoid jargon unless explaining it
- Use analogies to real-world concepts (gas = toll fee, hash = receipt number)
- Be specific to their actual transaction data
- Highlight important security concerns
- If they ask about a specific transaction, reference it by number or timestamp
- Break down transaction details step-by-step
- Calculate totals and averages when relevant
- Point out interesting patterns in their history

Example Responses:
User: "What's my most recent transaction?"
You: "Your most recent transaction was sent on [date] where you sent 0.5 ETH to [address]. The transaction was successful and cost you 0.002 ETH in gas fees. This looks like a regular transfer to another wallet."

User: "Why are gas fees so high?"
You: "Gas fees are like toll fees for using the Ethereum network. When lots of people are transacting at once, fees go up (like rush hour traffic). Looking at your history, you've paid an average of 0.003 ETH per transaction. To save money, try transacting during off-peak hours like early morning or late at night."

User: "Why did this transaction fail?"
You: "Transaction #5 failed on [date]. Even though it failed, you still paid the gas fee of 0.001 ETH. Common reasons for failures: insufficient balance, incorrect contract interaction, or gas limit too low. In your case, [analyze the specific transaction details to provide context]."

User: "How much have I spent on gas?"
You: "Based on your ${
        transactions.length
      } transactions, you've spent a total of [calculate from data] ETH on gas fees. That's an average of [calculate] ETH per transaction. This is pretty typical for Ethereum mainnet transactions."

Be helpful, educational, and always put the user's understanding and security first.`
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[TRANSACTIONS CHAT] Error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
