# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15.5.4 application using the App Router architecture with React 19.1.0, TypeScript, and Tailwind CSS v4. The project uses Turbopack as the bundler for both development and production builds.

## Common Commands

### Development
```bash
npm run dev        # Start development server with Turbopack on http://localhost:3000
npm run build      # Build for production with Turbopack
npm start          # Start production server
npm run lint       # Run ESLint
```

### Development Notes
- The dev server runs on http://localhost:3000 by default
- Hot reload is enabled - changes to `src/app/page.tsx` and other files will auto-update
- Turbopack (`--turbopack` flag) is used for both dev and build for faster compilation

## Architecture

### App Router Structure
This project uses Next.js App Router with file-system based routing:
- `src/app/` - App Router directory containing all routes and layouts
- `src/app/layout.tsx` - Root layout that wraps all pages, includes font configuration (Geist Sans and Geist Mono)
- `src/app/page.tsx` - Home page component (route: `/`)
- `src/app/globals.css` - Global Tailwind CSS styles

### Path Aliases
- `@/*` maps to `./src/*` for cleaner imports (configured in tsconfig.json)

### Styling
- Tailwind CSS v4 with PostCSS plugin (`@tailwindcss/postcss`)
- Tailwind utility classes are used directly in TSX files
- Global styles in `src/app/globals.css`
- Font variables: `--font-geist-sans` and `--font-geist-mono` available globally

### Static Assets
- Place static files in `public/` directory
- Access via root path (e.g., `public/next.svg` → `/next.svg`)

## TypeScript Configuration

- Strict mode enabled
- Module resolution: bundler
- Path alias `@/*` for `./src/*`
- Target: ES2017

## ESLint

- Flat config format (eslint.config.mjs)
- Extends: `next/core-web-vitals` and `next/typescript`
- Ignores: node_modules, .next, out, build, next-env.d.ts
