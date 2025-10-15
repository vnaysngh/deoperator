# Tool Output Convention - MUST FOLLOW

## The Problem We're Solving

**AI models (especially OpenAI GPT-4) frequently stop after tool calls without generating text responses.**

This results in blank UI and frustrated users. After debugging this issue multiple times, we established this convention.

## The Rule: Every Tool MUST Return a Message Field

### For Success Responses:
```typescript
return {
  success: true,
  message: "User-friendly message describing the result",
  // ... other data
};
```

### For Error Responses:
```typescript
return {
  success: false,
  userMessage: "User-friendly error message with actionable guidance",
  error: "Technical error details for logs"
};
```

## Client-Side Guarantee

The React component in `Chat.tsx` has a **universal fallback handler** that renders:
- Any `output.userMessage` (for errors)
- Any `output.message` (for success)

This ensures users ALWAYS see feedback, regardless of AI behavior.

## Checklist for Adding New Tools

When creating a new tool, follow these steps:

### 1. Design Tool Response Structure

```typescript
// ✅ CORRECT - Has message field
{
  success: true,
  message: "Found 5 tokens in your wallet",
  data: { /* ... */ }
}

// ❌ WRONG - No message field, relies on AI
{
  success: true,
  data: { /* ... */ }
}
```

### 2. Add to All Code Paths

Every return statement in your tool MUST have a message:

```typescript
// Success path
if (result) {
  return {
    success: true,
    message: `Successfully processed ${result.count} items`,
    data: result
  };
}

// Error path
if (!found) {
  return {
    success: false,
    userMessage: "Could not find the requested resource. Please try again.",
    error: "Resource not found"
  };
}

// Exception path
catch (error) {
  return {
    success: false,
    userMessage: "Something went wrong. Please try again.",
    error: error.message
  };
}
```

### 3. Test Tool Without AI

**CRITICAL**: Test that your tool output displays in UI even if AI doesn't respond.

```bash
# 1. Make a test request
# 2. Check server logs for: [AI] ⚠️ WARNING: AI stopped after tool calls
# 3. Verify UI shows the message (not blank)
```

### 4. Document in Testing Checklist

Add your new tool to `TESTING_CHECKLIST.md` with:
- Success case test
- Error case test
- "AI doesn't respond" case test

## Real Examples from Codebase

### ✅ GOOD: getSwapQuote

```typescript
// Error case
if (!fromTokenInfo) {
  return {
    success: false,
    userMessage: `I couldn't find ${fromToken} on ${chainName}. Could you double-check the token symbol?`,
    error: `Token not found: ${fromToken}`
  };
}

// Liquidity error
if (quoteResponse.status === 404) {
  return {
    success: false,
    userMessage: `There isn't enough liquidity to swap ${amount} ${fromToken}. Try a smaller amount.`,
    error: 'Insufficient liquidity'
  };
}
```

### ✅ GOOD: getSpecificBalances

```typescript
// Single token response
if (isSingleToken) {
  return {
    success: true,
    message: `Your ${symbol} balance is ${balance} ${symbol}, worth $${usdValue} USD`,
    singleTokenResponse: true,
    tokenDetails: { /* ... */ }
  };
}
```

### ❌ BAD: Hypothetical broken tool

```typescript
// This will cause blank UI if AI doesn't respond
return {
  success: true,
  // ❌ NO MESSAGE FIELD!
  data: results
};
```

## Why This Matters

### Before This Convention:
1. Tool returns data ✅
2. AI receives data ✅
3. AI stops without text ❌
4. Client renders nothing ❌
5. **User sees blank screen** ❌
6. Developer spends 30 minutes debugging ❌

### After This Convention:
1. Tool returns data + message ✅
2. AI receives data ✅
3. AI stops without text (doesn't matter) ✅
4. Client renders tool.message ✅
5. **User sees feedback** ✅
6. Developer moves on to next feature ✅

## Enforcement

### Pre-Commit Checklist:
Before committing any new tool:
- [ ] All return statements have `message` or `userMessage`
- [ ] Tested with AI not responding (check for warning in logs)
- [ ] Verified UI displays message (not blank)
- [ ] Added to `TESTING_CHECKLIST.md`

### Code Review Checklist:
When reviewing tool code:
- [ ] Search for `return {` - does every return have a message field?
- [ ] Are messages user-friendly and actionable?
- [ ] Are error messages helpful (not just "Error occurred")?

## The Bottom Line

**Never trust the AI to display your tool's output.**

Always include a `message` or `userMessage` field so the client can render it as a fallback.

This is not optional. This is not a "nice to have". This is **required** to prevent blank UI.

---

**Last Updated**: After debugging the same issue 3 times
**Lesson Learned**: Design around AI limitations, don't fight them
