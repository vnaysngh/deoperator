# Codex Agent Notes

This is a quick-reference for future Codex-style agents dropping into **Unipilot / DexLuthor**, the natural-language trading demo.

## Mental Model
- **UI shell** lives in `src/app/page.tsx` and hands rendering to `src/components/Chat.tsx`; WalletConnect lives alongside in `WalletConnect.tsx`.
- **Chat backend** is a single `POST` handler in `src/app/api/chat/route.ts` wired to `@ai-sdk/openai`. The route performs tool calling and streams results back to the client.
- **Protocol logic** is split under `src/lib`:
  - `cowswap-client.ts` runs entirely in the browser and wraps the CoW Protocol Trading SDK (quote + submit, allowance helpers).
  - `sushiswap.ts` hits Sushi’s quote APIs for non-CoW flows.
  - `tokens.ts` builds a cached token registry by merging the Uniswap and PancakeSwap lists (fallback map included).
  - `wallet-balances.ts` fetches Moralis wallet holdings and enriches them with USD valuations.
  - `chains.ts` restricts support to Arbitrum (42161) and BNB Chain (56); anything else must be declined.

## Chat Surface Fundamentals (`src/components/Chat.tsx`)
- The Vercel AI `useChat` hook streams deltas; `DefaultChatTransport` injects the connected wallet address via the `x-wallet-address` header.
- Tool payloads are rendered client-side. Pay attention to these guard rails:
  - `needsClientQuote` → show a quote request UI that calls `quoteAndSubmitSwap`.
  - `needsClientSubmission` → display the “Create Order” button that ultimately signs/submits via the Trading SDK.
  - `needsClientBalanceFetch` → fetch balances locally before quoting “swap my entire balance” requests.
  - Every tool response should include `message` or `userMessage`; the component treats them as fallbacks when the model stops right after tool calls.
- The component keeps global quote state (`latestQuoteTimestamp`, `quoteListeners`) so multiple tool results stay in sync.

## Tooling Responsibilities (`src/app/api/chat/route.ts`)
- System prompt enforces the “supported chains only” stance and explains the balance/price/swap tool split.
- Always resolve symbols through `getTokenBySymbol` / `normalizeTokenSymbol`; contract addresses are handled verbatim.
- After tool calls, the handler logs finish reasons to catch silent model exits—don’t regress the logging.
- When adding tools:
  1. Return both `success` flags and user-facing strings.
  2. Extend the Chat component only if new client behaviour is required.
  3. Document the silent/streaming cases in `TESTING_CHECKLIST.md`.

## Data & Integrations
- **Token discovery** caches results for an hour; keep cache invalidation in mind when editing token-metadata flows.
- **Moralis** (requires `MORALIS_API_KEY`) backs both wallet portfolio lookups and USD pricing.
- **Sushi API** still handles swap quotes when the chat flow needs Sushi as a fallback path; respect the chain whitelist before hitting the endpoints.
- **Uniswap fallback** (`swapClient.ts`) still exists for legacy direct router interactions; CoW is the primary path exposed in chat.

## Dev Workflow Essentials
- Run `npm run dev` for Turbopack, `npm run lint` before shipping, and `node test-cowswap-sdk.js` when touching CoW logic.
- Two-space indentation, double quotes, semicolons—mirror `src/app/page.tsx`.
- Tailwind class order matters (layout before colour utilities).
- Prefer `@/lib/...` imports over relative paths to stay aligned with the configured alias.

## Edge Cases to Watch
- Model can finish with `finishReason: "tool-calls"` and empty text; rely on tool payloads to populate the UI.
- Entire-balance swaps must route through `getSwapQuoteForEntireBalance` so the client can fetch balances and quotes atomically.
- Decline requests for unsupported chains (Ethereum, Polygon, etc.) and redirect them to Arbitrum or BNB Chain per the system prompt.
- When Moralis or token list fetch fails, the code falls back to a curated token map; preserve that safety net.

Armed with this, you should be able to reason about new features or debugging sessions without spelunking the entire repo first.
