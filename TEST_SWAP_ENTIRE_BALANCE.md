# Test: Swap Entire Balance Feature

## What Was Implemented

### Problem
User said "swap my whole USDC balance to ARB on arbitrum" and the system:
1. Called `getSpecificBalances` to get balance → returned "1.736251 USDC"
2. Stopped without continuing to get a quote or ask for confirmation
3. User saw incomplete response with bad UX message "(Use this amount for the swap quote)"

### Root Cause
- AI doesn't reliably chain multiple tool calls (even with `maxSteps: 10`)
- Fighting against AI behavior instead of proper design
- Confusing internal AI instructions with user-facing messages

### Solution
Created a new **composite tool** `getSwapQuoteForEntireBalance` that:
- Fetches the user's balance
- Validates both tokens exist
- Checks liquidity with CoW Protocol
- Returns all data needed for quote display
- **All in ONE atomic tool call**

## Implementation Details

### New Tool: `getSwapQuoteForEntireBalance`

**File:** `src/app/api/chat/route.ts` (lines 863-1005)

**When to use:**
- User explicitly says "swap my whole/all/entire balance"
- Examples: "swap my whole USDC balance", "swap all my ARB", "swap my entire USDC"

**What it does:**
1. Checks wallet is connected
2. Fetches balance for `fromToken`
3. Validates balance is not zero
4. Validates `toToken` exists
5. Checks liquidity with CoW Protocol API
6. Returns data with `needsClientQuote: true`

**Response format:**
```typescript
{
  success: true,
  chain: "Arbitrum",
  chainId: 42161,
  fromToken: "USDC",
  toToken: "ARB",
  amount: "1.736251", // The actual balance
  fromTokenAddress: "0x...",
  fromTokenDecimals: 6,
  toTokenAddress: "0x...",
  toTokenDecimals: 18,
  needsClientQuote: true, // Triggers QuoteDisplay component
  message: "You have 1.736251 USDC. Getting quote to swap it all for ARB..."
}
```

### System Prompt Update

**File:** `src/app/api/chat/route.ts` (lines 186-197)

Added explicit instructions:
```
⚠️ SPECIAL CASE - "swap my whole/all/entire balance":
When user says "swap my whole USDC balance" or "swap all my USDC":
- Use the getSwapQuoteForEntireBalance tool (NOT getSpecificBalances + getSwapQuote)
- This tool fetches balance AND gets quote in ONE step
- It returns needsClientQuote: true which triggers the UI to show the quote
```

### Client-Side Handling

**File:** `src/components/Chat.tsx` (lines 130-139)

QuoteDisplay component already handles `needsClientQuote: true`:
- Fetches actual quote from CoW Protocol SDK
- Displays quote with "Create Order" button
- User can confirm and proceed with swap

## Test Plan

### Test Case 1: Swap Entire Balance (Happy Path)
**Command:** `"swap my whole USDC balance to ARB on arbitrum"`

**Expected Behavior:**
1. AI recognizes "whole balance" keyword
2. AI calls `getSwapQuoteForEntireBalance` (not `getSpecificBalances`)
3. Tool returns: `{ success: true, amount: "1.736251", needsClientQuote: true, message: "You have 1.736251 USDC. Getting quote to swap it all for ARB..." }`
4. User sees message: "You have 1.736251 USDC. Getting quote to swap it all for ARB..."
5. QuoteDisplay component fetches real-time quote
6. User sees quote UI with "Create Order" button
7. User can click button to proceed

**Server Log Checkpoints:**
```
[TOOL:getSwapQuoteForEntireBalance] Getting balance and quote
[TOOL:getSwapQuoteForEntireBalance] USDC balance: 1.736251
[TOOL:getSwapQuoteForEntireBalance] Returning success result
```

### Test Case 2: Zero Balance
**Command:** `"swap my whole DAI balance to USDC on arbitrum"` (assuming zero DAI)

**Expected Behavior:**
```json
{
  "success": false,
  "userMessage": "You don't have any DAI to swap on Arbitrum.",
  "error": "Zero balance"
}
```

### Test Case 3: Token Not Found
**Command:** `"swap my whole FAKETOKEN balance to USDC on arbitrum"`

**Expected Behavior:**
```json
{
  "success": false,
  "userMessage": "I couldn't find FAKETOKEN on Arbitrum. Could you double-check the token symbol?",
  "error": "Token not found: FAKETOKEN"
}
```

### Test Case 4: Insufficient Liquidity
**Command:** `"swap my whole MORPHO balance to USDC on arbitrum"` (assuming large balance)

**Expected Behavior:**
```json
{
  "success": false,
  "userMessage": "You have X MORPHO ($Y.YY), but there isn't enough liquidity to swap it all for USDC on Arbitrum. Try swapping a smaller amount.",
  "error": "Insufficient liquidity"
}
```

### Test Case 5: Wallet Not Connected
**Command:** `"swap my whole USDC balance to ARB on arbitrum"` (disconnected wallet)

**Expected Behavior:**
```json
{
  "success": false,
  "userMessage": "Please connect your wallet first.",
  "error": "Wallet address not provided"
}
```

## How to Test

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Connect wallet** with some USDC on Arbitrum

3. **Open browser console** to monitor logs

4. **Try the command:** "swap my whole USDC balance to ARB on arbitrum"

5. **Verify:**
   - ✅ Message shows: "You have X USDC. Getting quote to swap it all for ARB..."
   - ✅ Quote display appears with correct amount
   - ✅ "Create Order" button is clickable
   - ✅ No intermediate "(Use this amount...)" message
   - ✅ No blank UI if AI stops after tool call

6. **Check server logs for:**
   ```
   [TOOL:getSwapQuoteForEntireBalance] Getting balance and quote
   [TOOL:getSwapQuoteForEntireBalance] USDC balance: X.XXXXXX
   ```

7. **Test error cases** (zero balance, fake token, disconnected wallet)

## Success Criteria

✅ **User Experience:**
- User sees balance immediately
- User sees "Getting quote..." message
- Quote appears automatically
- "Create Order" button works
- No confusing messages

✅ **Technical:**
- Only ONE tool call (getSwapQuoteForEntireBalance)
- Not TWO tool calls (getSpecificBalances + getSwapQuote)
- AI doesn't need to chain multiple tools
- Works even if AI stops after tool call (universal fallback)

✅ **Error Handling:**
- Zero balance → user-friendly message
- Token not found → helpful suggestion
- Insufficient liquidity → actionable guidance
- Wallet not connected → clear instruction

## Architecture Benefits

1. **Atomic Operation:** Entire flow in one tool call
2. **AI-Agnostic:** Works regardless of AI behavior
3. **Fallback Safe:** Universal message handler catches output
4. **User-Friendly:** Clear progress messages at every step
5. **Maintainable:** Single source of truth for "swap entire balance" logic

## Comparison: Old vs New

### OLD Approach (Broken)
```
User: "swap my whole USDC balance"
→ AI calls getSpecificBalances
→ Tool returns: "1.736251 USDC (Use this amount for the swap quote)" ❌ Bad UX
→ AI stops (finishReason: 'tool-calls', text: '') ❌
→ User sees incomplete response ❌
```

### NEW Approach (Fixed)
```
User: "swap my whole USDC balance to ARB on arbitrum"
→ AI calls getSwapQuoteForEntireBalance ✅ Single atomic call
→ Tool returns: { amount: "1.736251", needsClientQuote: true, message: "..." } ✅
→ User sees: "You have 1.736251 USDC. Getting quote..." ✅
→ Quote appears automatically ✅
→ User can confirm and proceed ✅
```

---

**Ready to test!** Try the command: `"swap my whole USDC balance to ARB on arbitrum"`
