/**
 * HardwareStack scraping pipeline
 *
 * Usage:
 *   npm run scraper:cpus        – scrape + normalise CPUs → DB
 *   npm run scraper:gpus        – scrape + normalise GPUs → DB
 *   npm run scraper:all         – run both in sequence
 *
 * Intermediate results are cached in scripts/scraper/.cache/ so a failed run
 * can resume without re-scraping or re-calling the Claude API.
 *
 * Requires: DATABASE_URL and ANTHROPIC_API_KEY in .env
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { scrapeCpus, scrapeGpus } from "./sources/passmark";
import { normalizeCpus, normalizeGpus } from "./normalizer";
import { prisma } from "./db";
import type { NormalizedCpu, NormalizedGpu } from "./types";

const CACHE_DIR = path.join(__dirname, ".cache");

function cacheRead<T>(file: string): T | null {
  const p = path.join(CACHE_DIR, file);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

function cacheWrite(file: string, data: unknown): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, file), JSON.stringify(data, null, 2));
}

// ─── CPU pipeline ────────────────────────────────────────────────────────────

async function runCpus() {
  console.log("\n=== CPU pipeline ===");

  let raw = cacheRead<ReturnType<typeof scrapeCpus> extends Promise<infer T> ? T : never>("cpus-raw.json");
  if (!raw) {
    console.log("Scraping PassMark CPU list…");
    raw = await scrapeCpus();
    cacheWrite("cpus-raw.json", raw);
    console.log(`  Scraped ${raw.length} raw entries`);
  } else {
    console.log(`  Using cached raw data (${raw.length} entries)`);
  }

  let normalized = cacheRead<NormalizedCpu[]>("cpus-normalized.json");
  if (!normalized) {
    console.log("Normalizing with Claude API…");
    normalized = await normalizeCpus(raw);
    cacheWrite("cpus-normalized.json", normalized);
    console.log(`  Kept ${normalized.length} valid desktop CPUs`);
  } else {
    console.log(`  Using cached normalized data (${normalized.length} entries)`);
  }

  console.log("Upserting to database…");
  let upserted = 0;
  for (const cpu of normalized) {
    // Reuse an existing row's spelling so casing variants never become a second row.
    const existing = await prisma.cpu.findFirst({
      where: { modelName: { equals: cpu.modelName, mode: "insensitive" } },
      select: { modelName: true },
    });
    await prisma.cpu.upsert({
      where: { modelName: existing?.modelName ?? cpu.modelName },
      update: {
        tier: cpu.tier,
        singleCoreScore: cpu.singleCoreScore,
        multiCoreScore: cpu.multiCoreScore,
      },
      create: cpu,
    });
    upserted++;
  }
  console.log(`  Upserted ${upserted} CPUs ✓`);
}

// ─── GPU pipeline ────────────────────────────────────────────────────────────

async function runGpus() {
  console.log("\n=== GPU pipeline ===");

  let raw = cacheRead<ReturnType<typeof scrapeGpus> extends Promise<infer T> ? T : never>("gpus-raw.json");
  if (!raw) {
    console.log("Scraping PassMark GPU list…");
    raw = await scrapeGpus(200);
    cacheWrite("gpus-raw.json", raw);
    console.log(`  Scraped ${raw.length} raw entries`);
  } else {
    console.log(`  Using cached raw data (${raw.length} entries)`);
  }

  let normalized = cacheRead<NormalizedGpu[]>("gpus-normalized.json");
  if (!normalized) {
    console.log("Normalizing with Claude API…");
    normalized = await normalizeGpus(raw);
    cacheWrite("gpus-normalized.json", normalized);
    console.log(`  Kept ${normalized.length} valid discrete GPUs`);
  } else {
    console.log(`  Using cached normalized data (${normalized.length} entries)`);
  }

  console.log("Upserting to database…");
  let upserted = 0;
  for (const gpu of normalized) {
    // Reuse an existing row's spelling so "Super"/"SUPER" variants never become a second row.
    const existing = await prisma.gpu.findFirst({
      where: { modelName: { equals: gpu.modelName, mode: "insensitive" } },
      select: { modelName: true },
    });
    await prisma.gpu.upsert({
      where: { modelName: existing?.modelName ?? gpu.modelName },
      update: { tier: gpu.tier, rasterScore: gpu.rasterScore, memoryBandwidthGbs: gpu.memoryBandwidthGbs },
      create: gpu,
    });
    upserted++;
  }
  console.log(`  Upserted ${upserted} GPUs ✓`);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const MODE = process.argv[2] ?? "all";

async function main() {
  try {
    if (MODE === "cpus" || MODE === "all") await runCpus();
    if (MODE === "gpus" || MODE === "all") await runGpus();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
