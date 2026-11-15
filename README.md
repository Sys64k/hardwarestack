# HardwareStack

PC hardware bottleneck calculator with upgrade recommendations. Select your CPU, GPU, and RAM to see which component is holding back your system at 1080p, 1440p, or 4K — and get socket-aware upgrade suggestions: a drop-in that fits your current motherboard first, and a platform upgrade (naming the new motherboard socket and RAM type it needs) only when no drop-in removes the bottleneck and the new CPU beats the best drop-in. A platform upgrade never moves to an older platform from either vendor (eras in `SOCKET_ERA`: AM4/LGA1200, then LGA1700, then AM5/LGA1851), and CPUs are ranked by measured gaming performance rather than the tier label. RAM suggestions only include kits your CPU's socket takes. Links go to Amazon (affiliate) or, with no affiliate tag set, Google Shopping. The logic lives in `lib/upgrade.ts` and `lib/platform.ts`.

The CPU side of the bottleneck uses a gaming index (percent of the fastest gaming CPU at 1080p) from published reviews — Tom's Hardware's CPU hierarchy, plus TechSpot for two AM4 chips — kept with its sources in `lib/cpu-gaming-index.ts`. CPUs without a review figure get an estimate fitted to the measured ones (single-thread score, X3D cache, AM4 platform). The GPU side works the same way in `lib/gpu-gaming-index.ts`: Tom's Hardware's GPU hierarchy at 1440p Ultra, with an estimate from the PassMark raster score for GPUs it doesn't list. To add or update figures, edit those files; each pair page credits the source of its CPU's and GPU's figures.

Live at **[hardwarestack.dev](https://hardwarestack.dev)**

## Pages

| Route | Content |
|---|---|
| `/` | Bottleneck calculator (CPU, GPU, optional RAM, resolution) |
| `/cpu/[slug]`, `/gpu/[slug]` | Specs and pairing table per component |
| `/bottleneck/[cpu]-vs-[gpu]` | Static result for one CPU + GPU pair at 1080p, 1440p and 4K, with related pairs. Every scored pair resolves; the sitemap and related links list a subset (`isSitemapPair` in `lib/pair-pages.ts`) |
| `/local-ai/coding-agents` | Agentic coding test results with measured speed, VRAM estimates and the smallest GPU per model |
| `/local-ai`, `/local-ai/[model]` | Local AI calculator and per-model VRAM pages, plus agentic coding test results from the ASO experiment (data in `lib/agentic-coding-test.ts`) and speeds measured on the test machine (`lib/measured-llm-speed.ts`) |

The sitemap lists the pair pages where both parts have a review figure and are at most one tier apart (about 1,150 of 6,800). The other pair pages still load (the calculator links to them) and are not noindexed; they're just not advertised to crawlers.

## Stack

- **Next.js 16** (App Router, React Server Components)
- **Prisma 7** + **PostgreSQL** (Neon, production)
- **Tailwind CSS v4** + **shadcn/ui v4**
- **Recharts** — utilization gauge charts
- Deployed on **Fly.io** (Docker, standalone bundle)

## Local development

```bash
# 1. Install dependencies
npm install
npx prisma generate       # generates client into lib/generated/prisma/

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local — set DATABASE_URL to your local Postgres instance

# 3. Apply schema and seed (or push local DB to prod, see scripts/)
npx prisma migrate dev

# 4. Start dev server
npm run dev               # http://localhost:3000
```

Other useful commands:

```bash
npm run build             # production build (standalone)
npm run lint              # ESLint
npx prisma studio         # GUI for the database
```

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (pooled for app runtime) |
| `DIRECT_URL` | Direct connection string — required for Prisma migrations (bypasses connection poolers) |
| `REVALIDATE_TOKEN` | Secret for `POST /api/revalidate` cache invalidation endpoint |
| `ANTHROPIC_API_KEY` | Claude API key — scraper pipeline only, never exposed to the browser |
| `NEXT_PUBLIC_CF_BEACON_TOKEN` | Cloudflare Web Analytics site token (cookieless visit stats). Inlined at build time — set in `fly.toml` `[build.args]` for production; omit to disable |
| `NEXT_PUBLIC_AMAZON_AFFILIATE_TAG` | Amazon.de Associates tracking ID; adds tagged Amazon links and the affiliate disclosure. Inlined at build time — set in `fly.toml` `[build.args]`; omit to fall back to Google Shopping |

See `.env.example` for the full list.

## Data pipeline

Scraping lives entirely outside this app in `scripts/scraper/` — a standalone Node.js pipeline that:

1. Fetches hardware specs from retail sources
2. Uses a local LLM to map retail product names to canonical CPU/GPU entries
3. Inserts `RetailLink` rows (ASIN → canonical component) into the database

The app itself never imports Playwright or runs scraping logic (would crash the Fly.io deployment).

After the scraper runs, call `POST /api/revalidate` with the `x-revalidate-token` header to flush the Next.js cache.

## Measuring local model speed

`scripts/bench/ollama-speed.mjs` measures prompt and generation speed through any Ollama server's API (standalone, not part of the app):

```bash
node scripts/bench/ollama-speed.mjs --host http://<ollama-host>:11434 \
  --models gpt-oss:20b,qwen3-coder:30b --contexts 8192,32768,65536 --runs 3 --out speed.json
```

Each model and context gets a warm-up, then `--runs` timed requests (median kept); every request starts differently so Ollama's prompt cache can't skip work. Copy the medians, and each model's `promptTokens`, into `lib/measured-llm-speed.ts`. Model pages then show them next to the calculator's estimate, with the time to the first word (the prompt size divided by the measured prompt speed).

The estimator's constants in `lib/ai-fit.ts` (desktop VRAM, runtime overhead, bandwidth efficiencies, per-token cost) are fitted to these measurements, and `lib/measured-llm-speed.test.ts` fails if any estimate drifts more than 25% from a measured speed. After adding measurements, refit the constants if that test fails.

## Database scripts

```bash
scripts/db-push-to-prod.sh   # dump local DB and restore to production (Neon)
scripts/db-reset-prod.sh     # truncate all production tables
scripts/prod-restart.sh      # restart Fly.io machines
scripts/shop-clicks-prod.sh  # read-only report of shop link clicks (default: last 30 days)
```

All scripts auto-load `.env.local`. Run them with `bash scripts/<name>.sh`.

`db-push-to-prod.sh` copies everything except `ShopClick` rows. Click counts exist only in production and are never overwritten.

## Shop click counts

Cloudflare Web Analytics can't count clicks on the shop links, so the site counts them itself. `ShopClickTracker`, mounted in the root layout, listens for clicks on Amazon, Google Shopping and PCPartPicker search links. For each one it sends a beacon to `POST /api/shop-click`. The route validates the beacon with Zod and keeps it only if the search names a CPU, GPU or RAM in the catalogue. It then adds one to a per-day counter in `ShopClick`, keyed by day, retailer, part and page type. Nothing about the visitor is stored: no IP, user agent, cookie or URL. The logic is in `lib/shop-clicks.ts` and `lib/shop-click-schema.ts`.

## Deployment

```bash
fly deploy                            # build image and deploy to Fly.io
fly secrets set DATABASE_URL="..."    # set/update production secrets
fly secrets set DIRECT_URL="..."
fly secrets set REVALIDATE_TOKEN="..."
```

Each push to `main` deploys through `.github/workflows/deploy.yml`. It runs lint, typecheck and tests, then deploys. Deploys run one at a time in push order, so back-to-back merges can't leave the older commit live. After each deploy, a smoke check loads the home page, a pair page, `/local-ai` and the sitemap from the Fly origin (`hardwarestack.fly.dev`, since Cloudflare blocks GitHub's runners), and fails the run if any of them is broken.

The `Dockerfile` runs `npx prisma generate` before `npm run build` so the generated Prisma client is bundled in the standalone output. `next.config.ts` is set to `output: "standalone"` — do not remove this.
