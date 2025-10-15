# Repository Guidelines

## Project Structure & Module Organization
The Next.js 15 app router lives under `src/app`, with `page.tsx` hosting the chat UI and `app/api/chat/route.ts` handling AI requests. Shared UI pieces (chat window, wallet button) sit in `src/components`, while protocol and token logic is grouped in `src/lib` (for example `cowswap-client.ts`, `tokens.ts`, `uniswap.ts`). Static assets and icons belong in `public`, and Tailwind globals are wired through `src/app/global.css`. Keep self-contained feature work within these folders and favour colocating helper modules beside the feature they serve.

## Build, Test, and Development Commands
- `npm run dev` starts the Turbopack dev server on port 3000 with hot reload.
- `npm run build` compiles the production bundle; run before shipping to catch route and type issues.
- `npm run lint` executes the shared ESLint config; pass `--fix` locally if you intend to commit the result.
- `node test-cowswap-sdk.js` exercises the CoW Protocol quote helpers without booting the UI.

## Coding Style & Naming Conventions
Typescript is the default; prefer type-safe imports from `@/lib` and explicit return types on exported functions. Follow the existing two-space indentation, double quotes, and semicolon usage seen across `src/app/page.tsx`. Components and hooks use PascalCase (`Chat`, `WalletConnect`), utility modules in `src/lib` use camelCase filenames (`swapClient.ts`). Tailwind classes should group structural utilities before color tokens for readability. Rely on `eslint.config.mjs` (Next + TypeScript rules) before finalising changes; add clarifying comments only around complex on-chain workflows.

## Testing Guidelines
UI changes must be lint-clean and, when they affect protocol logic, validated through `node test-cowswap-sdk.js` or targeted wallet simulations. There is no automated coverage target yet, so document the manual scenarios you exercised in your PR description (e.g., “Swap 1 WETH→USDC on Sepolia”). When adding new modules, include lightweight unit helpers in `src/lib/__tests__` or colocated files and wire them into a future `npm test` script if feasible.

## Commit & Pull Request Guidelines
The history uses concise, imperative messages (`handle decimal amounts`, `walletconnect updates`). Match that style: start with a lowercase verb, keep the subject ≤ 60 characters, and expand in the body only when necessary (wrap at ~72 columns). For pull requests, provide: a one-paragraph summary, screenshots or terminal logs for UI or protocol flows, a checklist of executed commands, and any environment variables or secrets that need updates. Link related issues and call out follow-up work so reviewers can triage quickly.

## Environment & Secrets
Add new configuration keys to `.env.example` and document usage in `README.md`. Never commit actual API keys or wallet secrets; rely on `.env.local` in development and Vercel project settings in production. When touching on-chain integrations, note the expected chain ID and RPC provider so other contributors can reproduce your setup.
