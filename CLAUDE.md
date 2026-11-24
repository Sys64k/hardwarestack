# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Production build (outputs standalone bundle)
npm run lint       # ESLint

npx prisma generate          # Regenerate Prisma client after schema changes
npx prisma migrate dev       # Apply migrations locally (requires DATABASE_URL)
npx prisma studio            # Open Prisma Studio GUI
npx prisma db push           # Push schema without migration history (dev only)
```

## Architecture

**Next.js 16 (App Router) + TypeScript strict mode.** All data-fetching components are React Server Components by default; client interactivity is opt-in with `"use client"`.

### Key constraints
- `next.config.ts` is set to `output: "standalone"` — required for the Docker build to fit Fly.io micro-VM memory limits. Do not remove this.
- **Scraping is never inside this app.** All Playwright/web-scraping logic lives in a separate local Node.js script. Importing Playwright here will crash the Fly.io deployment.
- TypeScript `any` is banned. Interfaces and types must be explicit.
- E2E tests: Webkit is disabled. Chromium only.
- Branch management: use `git switch -c <name>` not `git checkout -b`.

### Database (Prisma 7 + PostgreSQL)
- Schema: `prisma/schema.prisma`
- Generated client: `lib/generated/prisma/` (gitignored — run `npx prisma generate` after clone)
- Singleton: `lib/prisma.ts`
- **Prisma 7 uses Driver Adapters** — the client must be instantiated with `new PrismaPg(connectionString)`. There is no implicit `DATABASE_URL` read; the env var is consumed in `lib/prisma.ts`.
- DB connection config for CLI tools lives in `prisma.config.ts` (reads `DATABASE_URL`).

### Data model
- `Cpu` and `Gpu` are canonical hardware facts with enum-based `ComponentTier` (ENTRY → ENTHUSIAST) and `Vendor` (AMD, INTEL, NVIDIA).
- The scraper (`scripts/scraper/`) fills `Cpu` and `Gpu` from PassMark, normalised with the Claude API. Never scrape Amazon: its terms don't allow it.

### Styling
- Tailwind CSS v4 + shadcn/ui v4.
- Components are added individually via `npx shadcn@latest add <component>`.
- Palette: Slate/Zinc/White. Minimalist, engineering-dashboard aesthetic.
- Data viz: Recharts (utilization gauge charts for bottleneck display).

### Monetization
- Affiliate tag: `NEXT_PUBLIC_AMAZON_AFFILIATE_TAG` env var.
- Amazon links are tagged amazon.de **search** links built by `buildAmazonSearchUrl` in `lib/shopping-links.ts` (no prices: Amazon only allows prices from its official API). With no tag set, links fall back to Google Shopping.
- Never put prices in the database or pages: anything a page fetches ends up in the HTML sent to the browser, even if it isn't shown.
- Affiliate links use `rel="sponsored nofollow"`, buttons carry a visible "Affiliate Partner" label, and the footer shows "As an Amazon Associate I earn from qualifying purchases." Keep all three.

## Environment variables
Copy `.env.example` to `.env.local` for local dev:

```
DATABASE_URL=postgresql://user:password@localhost:5432/hardwarestack
NEXT_PUBLIC_AMAZON_AFFILIATE_TAG=hardwarestack-21
```

Production secrets are set on Fly.io via `fly secrets set KEY=value`.

## Docker / Fly.io deployment
```bash
fly launch          # First-time setup (reads fly.toml)
fly deploy          # Build image and deploy
fly secrets set DATABASE_URL="..."   # Set production DB URL
```

The multi-stage `Dockerfile` runs `npx prisma generate` before `npm run build` so the generated client is present in the standalone bundle.
