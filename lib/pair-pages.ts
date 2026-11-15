import { RESOLUTIONS, calculateBottleneck } from "./bottleneck";
import { measuredGamingIndex } from "./cpu-gaming-index";
import { gpuGamingScore, measuredGpuIndex } from "./gpu-gaming-index";
import { toSlug } from "./slug";
import { needsNewPlatform, planPartNames, planResolves, planUpgrade, type UpgradePlan } from "./upgrade";
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

// What removes the bottleneck at the resolutions where one part is the limit. Resolutions
// with the same limit and the same suggested parts share one entry.
export interface PairFix {
  resolutions: Resolution[];
  component: "CPU" | "GPU";
  plan: UpgradePlan | null; // null: no faster part in the catalogue
  resolves: boolean;        // planResolves(plan), kept so entries compare cheaply
  closest: string | null;   // the strongest suggested part (last in plan order)
}

function sameParts(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((name, i) => name === b[i]);
}

// `results` defaults to pairResults; the page passes the ones it already has.
export function pairFixes(
  cpu: CpuOption,
  gpu: GpuOption,
  cpus: CpuOption[],
  gpus: GpuOption[],
  results: ResolutionResult[] = pairResults(cpu, gpu)
): PairFix[] {
  const fixes: PairFix[] = [];
  for (const { resolution, result } of results) {
    const component = result.bottleneckComponent;
    if (component !== "CPU" && component !== "GPU") continue;
    // Pair pages assume good RAM, as in pairResults, so there's no RAM to upgrade.
    const plan = planUpgrade({ target: component, cpu, gpu, ram: undefined, cpus, gpus, rams: [], resolution });
    const resolves = plan !== null && planResolves(plan);
    const parts = planPartNames(plan);
    const prev = fixes.at(-1);
    if (prev && prev.component === component && prev.resolves === resolves && sameParts(planPartNames(prev.plan), parts)) {
      prev.resolutions.push(resolution);
    } else {
      fixes.push({ resolutions: [resolution], component, plan, resolves, closest: parts.at(-1) ?? null });
    }
  }
  return fixes;
}

const PART_NOUN: Record<"CPU" | "GPU", string> = { CPU: "CPU", GPU: "graphics card" };

// The heading over one fix, e.g. "1080p and 1440p: the CPU is the limit".
export function fixHeading(fix: PairFix): string {
  return `${joinList(fix.resolutions)}: the ${fix.component} is the limit`;
}

const SPARE_GPU_NOTE = "The graphics card has power to spare: a higher resolution puts it to use.";
const SPARE_CPU_NOTE = "The CPU has power to spare here.";
const UPSCALING_4K_NOTE = "At 4K that's normal: upscaling (DLSS, FSR or XeSS) or lower settings are the usual fix.";

type FixOutcome = "upgrade" | "new-platform" | "already-fastest" | "narrows-gap";

function fixOutcome(fix: PairFix): FixOutcome {
  if (!fix.plan) return "already-fastest";
  if (!fix.resolves) return "narrows-gap";
  return needsNewPlatform(fix.plan) ? "new-platform" : "upgrade";
}

// The sentence under the heading. When a part removes the bottleneck, the page lists it
// (with how it fits) below this; otherwise this sentence is the whole answer.
export function fixMessage(fix: PairFix, cpu: CpuOption, gpu: GpuOption): string {
  const noun = PART_NOUN[fix.component];
  // The other part is idle while this one is the limit.
  const spare = fix.component === "CPU" ? SPARE_GPU_NOTE : SPARE_CPU_NOTE;
  switch (fixOutcome(fix)) {
    case "upgrade":
      return `The smallest ${noun} upgrade that removes it:`;
    case "new-platform":
      return "No CPU that fits the current motherboard removes it; a new platform does:";
    case "already-fastest": {
      const current = fix.component === "CPU" ? cpu.modelName : gpu.modelName;
      return `The ${current} is already the fastest gaming ${noun} in our list, so no upgrade removes it. ${spare}`;
    }
    case "narrows-gap": {
      const gap = `No ${noun} in our list removes it; even the ${fix.closest} only narrows the gap.`;
      if (fix.component === "CPU") return `${gap} ${spare}`;
      return fix.resolutions.includes("4K") ? `${gap} ${UPSCALING_4K_NOTE}` : gap;
    }
  }
}

export interface PairSummary {
  results: ResolutionResult[];
  best: Resolution;
  verdict: string;
}

export function pairSummary(cpu: CpuOption, gpu: GpuOption): PairSummary {
  const results = pairResults(cpu, gpu);
  return {
    results,
    best: bestResolution(results),
    verdict: pairVerdict(results),
  };
}
