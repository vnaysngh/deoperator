# Testing Checklist for AI Tool Integration

**IMPORTANT**: Complete this checklist for EVERY new tool or error handling flow.

## Error Handling Requirements

### 1. Tool Returns Error
- [ ] Tool returns `{ success: false, userMessage: "...", error: "..." }`
- [ ] `userMessage` is user-friendly and actionable
- [ ] Error is logged with `console.log('[TOOL:name] Returning error:', JSON.stringify(result))`

### 2. Server-Side AI Response
- [ ] Check server logs for `[AI] Step finished` - does it have `text: ''` (empty)?
- [ ] Check `finishReason` - if it's `'tool-calls'`, AI stopped without responding
- [ ] If AI doesn't generate text, there MUST be client-side fallback

### 3. Client-Side UI Display
- [ ] Error message appears in UI (not blank screen)
- [ ] Message is displayed in a styled component (not `return null`)
- [ ] Check browser console for client-side errors

### 4. End-to-End Test Cases

Test these scenarios for EVERY tool:

#### Success Case
- [ ] Tool returns success
- [ ] UI displays result correctly
- [ ] No errors in server or client logs

#### Error Case 1: Token Not Found
- [ ] Try: "swap FAKETOKEN to USDC on arbitrum"
- [ ] Expected: Error message appears on UI immediately
- [ ] Check: Server logs show tool error returned
- [ ] Check: Client displays the `userMessage`

#### Error Case 2: Insufficient Liquidity
- [ ] Try: "swap 99999 ARB to USDC on arbitrum"
- [ ] Expected: Liquidity error appears on UI
- [ ] Check: Server detects 404 from CoW API
- [ ] Check: Client displays liquidity message

#### Error Case 3: Network Failure
- [ ] Simulate: Disconnect network during API call
- [ ] Expected: Generic error message appears
- [ ] Check: Doesn't crash, shows retry option

## Debugging Flow (When UI is Blank)

Follow this exact sequence:

1. **Check Server Logs First**
   ```bash
   tail -f /tmp/dev-server.log | grep -E '\[TOOL|\[AI\]'
   ```
   - Look for: `[TOOL:name] Returning ...` - is result present?
   - Look for: `[AI] Step finished` - is `text` empty?
   - Look for: `finishReason` - is it `'tool-calls'` instead of `'stop'`?

2. **Check Client-Side Rendering**
   - Open browser console
   - Look for message parts with `type: "tool-result"`
   - Check if `output` contains expected data
   - Search code for `return null` in tool result handling

3. **Check AI SDK Configuration**
   - Is `maxSteps` set? (Should be >= 3)
   - Are `onStepFinish` and `onFinish` logging?
   - Is the system prompt telling AI to respond?

## Common Mistakes to Avoid

❌ **DON'T**: Return `null` for tool errors and expect AI to handle it
✅ **DO**: Always render tool errors client-side as a fallback

❌ **DON'T**: Rely on AI to always generate text after tool calls
✅ **DO**: Display `userMessage` from tool output directly in UI

❌ **DON'T**: Have sparse logging - you'll be blind to issues
✅ **DO**: Log every step: tool input, tool output, AI steps, UI rendering

❌ **DON'T**: Test only success cases
✅ **DO**: Test error cases MORE than success cases

## Pre-Deployment Checklist

Before committing any AI tool integration:

- [ ] Test all error cases listed above
- [ ] Verify error messages appear on UI (not blank)
- [ ] Check server logs show proper flow
- [ ] Confirm no `return null` for error handling without AI fallback
- [ ] Add comprehensive logging for debugging
- [ ] Document expected behavior in code comments

## Time-Saving Debug Commands

```bash
# Watch server logs in real-time
tail -f /tmp/dev-server.log

# Filter for tool and AI logs only
tail -f /tmp/dev-server.log | grep -E '\[TOOL|\[AI\]'

# Check for empty AI responses
tail -f /tmp/dev-server.log | grep "text: ''"

# Check for tool-calls finish reason (bad)
tail -f /tmp/dev-server.log | grep "finishReason: 'tool-calls'"
```

## Root Cause of Today's Issue

**Problem**: UI was blank when tool returned error

**Why**:
1. Tool correctly returned `{ success: false, userMessage: "..." }`
2. AI received tool result but stopped with `finishReason: 'tool-calls'` and `text: ''`
3. Client-side code had `return null` for errors, expecting AI to handle it
4. AI didn't generate text → Client rendered nothing → Blank UI

**Fix**: Changed `return null` to render `userMessage` in styled component

**Lesson**: NEVER rely solely on AI to display messages. Always have client-side fallback.
