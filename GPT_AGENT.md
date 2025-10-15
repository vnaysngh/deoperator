# GPT Agent Playbook

This guide orients OpenAI-based coding agents (ChatGPT, GPT-4.1, o3, etc.) when contributing to this repository.

## Project Snapshot
- Next.js 15.5.4 (App Router) with React 19, TypeScript, Tailwind v4
- Turbopack drives both `npm run dev` and `npm run build`
- AI chat endpoint: `src/app/api/chat/route.ts`
- Primary UI surface: `src/app/page.tsx` and `src/components/Chat.tsx`
- Protocol helpers live under `src/lib` (Uniswap, CoW, Sushi integrations)

## Daily Driver Commands
- `npm run dev` → start the Turbopack dev server on http://localhost:3000
- `npm run build` → production build verification
- `npm run lint` → ESLint (flat config via `eslint.config.mjs`)
- `node test-cowswap-sdk.js` → quick CoW Protocol regression test

## Coding Norms You Must Mirror
- Typescript-first with explicit return types on exported functions
- Two-space indentation, double quotes, trailing semicolons
- Tailwind classes ordered structural → color tokens
- Prefer path aliases (`@/lib/...`) over relative dot paths
- Only add clarifying comments near complex on-chain flows

## Non-Negotiable Tool Convention
OpenAI models sometimes stop right after a tool call. To prevent blank UI states:
- Every tool `return {}` must include either `message` (success) or `userMessage` (errors)
- Run `./scripts/check-tool-messages.sh` before touching `src/app/api/chat/route.ts`
- Error responses should pair a friendly `userMessage` with a logged `error` string
- When adding a tool, document success/error/AI-silent cases in `TESTING_CHECKLIST.md`

## Testing Expectations
1. Lint anything you touch (`npm run lint`)
2. Exercise protocol helpers via `node test-cowswap-sdk.js` when relevant
3. For UI work, verify the chat surface renders tool fallbacks (see `Chat.tsx` around tool-result handling)
4. Capture manual test notes (tokens, chain IDs, balances) for reviewers

## Suggested Workflow
1. Read `CLAUDE.md`, `TOOL_CONVENTION.md`, and `TESTING_CHECKLIST.md` before large edits
2. Prototype in isolated helpers under `src/lib` when logic grows
3. Log tool I/O with distinctive `[TOOL:name]` prefixes for traceability
4. Never rely on the model to narrate results—surface them in the tool payload

## Shipping Checklist
- [ ] Lint clean
- [ ] Tool responses include `message`/`userMessage`
- [ ] Relevant manual tests recorded
- [ ] `.env.example` updated for new configuration and documented in `README.md`
- [ ] Commit message: short, imperative (e.g., `add swap slippage guard`)

Following this playbook keeps the chat experience responsive even when the model goes silent and gives reviewers the breadcrumbs they expect.
