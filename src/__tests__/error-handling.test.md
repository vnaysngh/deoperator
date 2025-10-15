# Manual Error Handling Test

## Purpose
Verify that error messages from tools are ALWAYS displayed to the user, even if AI doesn't generate a text response.

## Test Cases

### Test 1: Token Not Found Error
**Command**: "swap FAKETOKEN to USDC on arbitrum"

**Expected Behavior**:
1. Server logs show: `[TOOL:getSwapQuote] Returning from token error`
2. Server logs show: `[AI] Step finished` with `text: ''` or similar
3. **UI displays error message** (not blank)
4. Error message says: "I couldn't find FAKETOKEN on Arbitrum..."

**Actual Result**: [ PASS / FAIL ]

---

### Test 2: Insufficient Liquidity Error
**Command**: "swap 2 MORPHO to USDC on arbitrum"

**Expected Behavior**:
1. Server logs show: `[TOOL:getSwapQuote] Returning liquidity error`
2. Server logs show liquidity error result JSON
3. **UI displays error message** (not blank)
4. Error message says: "There isn't enough liquidity to swap 2 MORPHO..."

**Actual Result**: [ PASS / FAIL ]

---

### Test 3: Wallet Not Connected Error
**Command**: "show my balances on arbitrum" (with wallet disconnected)

**Expected Behavior**:
1. Server logs show: `[TOOL:getWalletBalances] Error: Wallet address not provided`
2. **UI displays error message** (not blank)
3. Error message asks user to connect wallet

**Actual Result**: [ PASS / FAIL ]

---

## Quick Verification Command

Run this test after ANY changes to tool error handling:

```bash
# 1. Start dev server
npm run dev

# 2. In another terminal, watch logs
tail -f /tmp/dev-server.log | grep -E '\[TOOL|\[AI\]'

# 3. In browser, test each error case above
# 4. Verify UI shows error (not blank)
# 5. Verify logs show tool error + AI response (or lack thereof)
```

## Regression Prevention

Before committing changes that touch:
- `src/app/api/chat/route.ts` (tool definitions)
- `src/components/Chat.tsx` (message rendering)
- Any tool execution code

Run all 3 test cases above and verify they PASS.

---

**Last Run**: [Date]
**Result**: [All Pass / Some Fail]
**Notes**: [Any observations]
