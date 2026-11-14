import { RESOLUTIONS, calculateBottleneck } from "./bottleneck";
import { measuredGamingIndex } from "./cpu-gaming-index";
import { gpuGamingScore, measuredGpuIndex } from "./gpu-gaming-index";
import { toSlug } from "./slug";
import type {
  BottleneckResult,
  CpuOption,
  GpuOption,
  Resolution,
  TierType,
} from "@/types/hardware";

const TIER_RANK: Record<TierType, number> = {
  ENTRY: 0,
  MID: 1,
  HIGH: 2,
  ULTRA: 3,
  ENTHUSIAST: 4,
};

// Every scored pair has a page, but only some go in the sitemap and "related" links,
// so crawlers spend their budget on the best pages (see isSitemapPair).
// Pairs further apart in tier than this are builds few people buy.
const MAX_SITEMAP_TIER_GAP = 1;

const SLUG_SEPARATOR = "-vs-";

export function pairSlug(cpuName: string, gpuName: string): string {
  return `${toSlug(cpuName)}${SLUG_SEPARATOR}${toSlug(gpuName)}`;
}

export function pairPath(cpuName: string, gpuName: string): string {
  return `/bottleneck/${pairSlug(cpuName, gpuName)}`;
}

// Matches against known slugs rather than splitting on "-vs-", so a model
// name that itself contains "vs" can't break the lookup.
export function parsePairSlug<C extends CpuOption, G extends GpuOption>(
  slug: string,
  cpus: C[],
  gpus: G[]
): { cpu: C; gpu: G } | null {
  for (const cpu of cpus) {
    const prefix = `${toSlug(cpu.modelName)}${SLUG_SEPARATOR}`;
    if (!slug.startsWith(prefix)) continue;
    const gpuSlug = slug.slice(prefix.length);
    const gpu = gpus.find((g) => toSlug(g.modelName) === gpuSlug);
    if (gpu) return { cpu, gpu };
  }
  return null;
}

// Link target for a pair, or null when the pair has no page.
export function pairHref(cpu: CpuOption, gpu: GpuOption): string | null {
  return hasScores(cpu, gpu) ? pairPath(cpu.modelName, gpu.modelName) : null;
}

// Without benchmark scores the calculator falls back to 0 and reports a
// meaningless "Balanced", so such pairs get no page at all.
export function hasScores(cpu: CpuOption, gpu: GpuOption): boolean {
  return cpu.singleCoreScore != null && gpu.rasterScore != null;
}

// Both parts have a review figure (directly or through a same-chip alias), so the
// verdict rests on published benchmarks rather than on an estimate from PassMark.
// Unlike hasScores, which only checks the database's PassMark-derived scores.
export function hasReviewFigures(cpu: CpuOption, gpu: GpuOption): boolean {
  return measuredGamingIndex(cpu.modelName) !== null && measuredGpuIndex(gpu.modelName) !== null;
}

// In the sitemap: scored, review figures on both sides, and at most one tier apart.
export function isSitemapPair(cpu: CpuOption, gpu: GpuOption): boolean {
  return (
    hasScores(cpu, gpu) &&
    hasReviewFigures(cpu, gpu) &&
    Math.abs(TIER_RANK[cpu.tier] - TIER_RANK[gpu.tier]) <= MAX_SITEMAP_TIER_GAP
  );
}

export function sitemapPairs(
  cpus: CpuOption[],
  gpus: GpuOption[]
): { cpu: CpuOption; gpu: GpuOption }[] {
  return cpus.flatMap((cpu) =>
    gpus.filter((gpu) => isSitemapPair(cpu, gpu)).map((gpu) => ({ cpu, gpu }))
  );
}

export interface ResolutionResult {
  resolution: Resolution;
  result: BottleneckResult;
}

export function pairResults(cpu: CpuOption, gpu: GpuOption): ResolutionResult[] {
  return RESOLUTIONS.map((resolution) => ({
    resolution,
    result: calculateBottleneck(cpu, gpu, resolution),
  }));
}

// Lowest imbalance wins; ties go to the higher resolution (better image for free).
export function bestResolution(results: ResolutionResult[]): Resolution {
  return results.reduce((best, r) =>
    r.result.bottleneckPercentage <= best.result.bottleneckPercentage ? r : best
  ).resolution;
}

export interface WorstBottleneck {
  resolution: Resolution;
  component: "CPU" | "GPU";
}

// The resolution with the largest CPU/GPU imbalance, or null when every resolution is balanced.
// Pair pages assume good RAM, so a RAM bottleneck can't occur here.
export function worstBottleneck(results: ResolutionResult[]): WorstBottleneck | null {
  let worst: WorstBottleneck | null = null;
  let worstPct = -1;
  for (const { resolution, result } of results) {
    const component = result.bottleneckComponent;
    if ((component === "CPU" || component === "GPU") && result.bottleneckPercentage > worstPct) {
      worst = { resolution, component };
      worstPct = result.bottleneckPercentage;
    }
  }
  return worst;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const VERDICT_PHRASE: Record<"CPU" | "GPU", string> = {
  CPU: "the CPU holds the GPU back at",
  GPU: "the GPU is the limit at",
};

// One clause per bottleneck type, e.g. "the GPU is the limit at 1440p (37% imbalance) and 4K (72%)".
export function pairVerdict(results: ResolutionResult[]): string {
  const balanced = results.filter((r) => r.result.bottleneckComponent === "Balanced");
  if (balanced.length === results.length) {
    return "Well matched at every resolution: neither part holds the other back.";
  }

  const parts: string[] = [];
  if (balanced.length > 0) {
    parts.push(`well matched at ${joinList(balanced.map((r) => r.resolution))}`);
  }
  for (const component of ["CPU", "GPU"] as const) {
    const limited = results.filter((r) => r.result.bottleneckComponent === component);
    if (limited.length === 0) continue;
    const at = limited.map(({ resolution, result }, i) => {
      const pct = Math.round(result.bottleneckPercentage);
      return `${resolution} (${pct}%${i === 0 ? " imbalance" : ""})`;
    });
    parts.push(`${VERDICT_PHRASE[component]} ${joinList(at)}`);
  }
  const sentence = parts.join("; ");
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

// Closest-performing alternatives that are themselves sitemap pairs,
// so related links only ever point at pages we want indexed.
export function relatedGpus(
  cpu: CpuOption,
  gpu: GpuOption,
  gpus: GpuOption[],
  limit = 6
): GpuOption[] {
  const target = gpuGamingScore(gpu);
  return gpus
    .filter((g) => g.id !== gpu.id && isSitemapPair(cpu, g))
    .map((g) => ({ g, distance: Math.abs(gpuGamingScore(g) - target) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(({ g }) => g);
}

export function relatedCpus(
  cpu: CpuOption,
  gpu: GpuOption,
  cpus: CpuOption[],
  limit = 6
): CpuOption[] {
  const target = cpu.singleCoreScore ?? 0;
  return cpus
    .filter((c) => c.id !== cpu.id && isSitemapPair(c, gpu))
    .sort(
      (a, b) =>
        Math.abs((a.singleCoreScore ?? 0) - target) - Math.abs((b.singleCoreScore ?? 0) - target)
    )
    .slice(0, limit);
}

export interface PairSummary {
  results: ResolutionResult[];
  best: Resolution;
  worst: WorstBottleneck | null;
  verdict: string;
}

export function pairSummary(cpu: CpuOption, gpu: GpuOption): PairSummary {
  const results = pairResults(cpu, gpu);
  return {
    results,
    best: bestResolution(results),
    worst: worstBottleneck(results),
    verdict: pairVerdict(results),
  };
}
