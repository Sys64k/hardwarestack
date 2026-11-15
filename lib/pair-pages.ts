import { RESOLUTIONS, calculateBottleneck } from "./bottleneck";
import { cpuGamingScore, gamingIndex, measuredGamingIndex } from "./cpu-gaming-index";
import { gpuGamingScore, gpuIndex, measuredGpuIndex } from "./gpu-gaming-index";
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

// The usual target for smooth play.
export const PLAYABLE_FPS = 60;

// The highest resolution where the pair still averages PLAYABLE_FPS, so a fast pair isn't
// sent to 1080p just because it's best balanced there; 1080p when no resolution gets there.
// `results` are in RESOLUTIONS order (lowest first), as pairResults returns them.
export function bestResolution(results: ResolutionResult[]): Resolution {
  const playable = results.filter((r) => r.result.fps >= PLAYABLE_FPS);
  return (playable.at(-1) ?? results[0])?.resolution ?? RESOLUTIONS[0];
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

// The items closest to `self` in gaming score that pass `keep`, nearest first.
function closestBy<T extends { id: string }>(
  items: T[],
  self: T,
  score: (item: T) => number,
  keep: (item: T) => boolean,
  limit: number
): T[] {
  const target = score(self);
  return items
    .filter((item) => item.id !== self.id && keep(item))
    .map((item) => ({ item, distance: Math.abs(score(item) - target) }))
    .sort((x, y) => x.distance - y.distance)
    .slice(0, limit)
    .map(({ item }) => item);
}

// Closest-performing alternatives that are themselves sitemap pairs,
// so related links only ever point at pages we want indexed.
export function relatedGpus(cpu: CpuOption, gpu: GpuOption, gpus: GpuOption[], limit = 6): GpuOption[] {
  return closestBy(gpus, gpu, gpuGamingScore, (g) => isSitemapPair(cpu, g), limit);
}

export function relatedCpus(cpu: CpuOption, gpu: GpuOption, cpus: CpuOption[], limit = 6): CpuOption[] {
  return closestBy(cpus, cpu, cpuGamingScore, (c) => isSitemapPair(c, gpu), limit);
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

// Where a part ranks on its gaming index (100 = the fastest in our list), flagged when the
// figure is an estimate rather than from a review.
function standing(index: number | null, measured: number | null): string {
  return `${Math.round(index ?? 0)}%${measured === null ? " (estimated)" : ""}`;
}

// The limited row with the largest imbalance for this part (first wins on ties), if any.
function worstFor(results: ResolutionResult[], component: "CPU" | "GPU"): ResolutionResult | undefined {
  const limited = results.filter((r) => r.result.bottleneckComponent === component);
  if (limited.length === 0) return undefined;
  return limited.reduce((worst, r) => (r.result.bottleneckPercentage > worst.result.bottleneckPercentage ? r : worst));
}

// A clause on how much of the other part's power goes unused where this row's part is the limit.
function unusedClause(row: ResolutionResult, cpu: CpuOption, gpu: GpuOption): string {
  return row.result.bottleneckComponent === "CPU"
    ? `about ${100 - row.result.gpuUtilization}% of the ${gpu.modelName}'s power goes unused, because the CPU can't prepare frames fast enough`
    : `the graphics card sets the frame rate, and about ${100 - row.result.cpuUtilization}% of the ${cpu.modelName}'s power goes unused`;
}

function bestOpening(resolution: Resolution, fps: number, playable: boolean): string {
  return playable
    ? `${resolution} is the best resolution for this pair: about ${fps} fps on average at high to ultra settings, the highest resolution that stays above ${PLAYABLE_FPS} fps.`
    : `Even at ${resolution} this pair averages only about ${fps} fps at high to ultra settings, so reaching ${PLAYABLE_FPS} fps takes lower settings, upscaling or a faster graphics card.`;
}

// Which part sets the frame rate at the best resolution. A GPU limit there is stated plainly,
// not as a problem: the fix block below offers the upgrade for anyone who wants more frames.
function bestLimitClause(row: ResolutionResult, cpu: CpuOption, gpu: GpuOption, playable: boolean): string {
  const limit = row.result.bottleneckComponent;
  if (limit === "GPU") {
    return playable ? "The graphics card sets the frame rate there; the CPU has frames to spare." : "The graphics card sets the frame rate there.";
  }
  if (limit === "CPU") return `The CPU is the limit there: ${unusedClause(row, cpu, gpu)}.`;
  return "The two are well matched there.";
}

// The frame rate at the best resolution, and which part sets it there.
function bestSentence(row: ResolutionResult, cpu: CpuOption, gpu: GpuOption): string {
  const fps = Math.round(row.result.fps);
  const playable = fps >= PLAYABLE_FPS;
  return `${bestOpening(row.resolution, fps, playable)} ${bestLimitClause(row, cpu, gpu, playable)}`;
}

// A few sentences on this pair, from its gaming figures and bottleneck results: where each
// part ranks, the frame rate at the best resolution, and how much of the faster part goes
// unused where the other one is the limit (once per part, at its worst resolution).
// `best` defaults to bestResolution(results); the page passes the one pairSummary has.
export function pairAnalysis(
  cpu: CpuOption,
  gpu: GpuOption,
  results: ResolutionResult[],
  best: Resolution = bestResolution(results)
): string[] {
  const cpuStanding = standing(gamingIndex(cpu), measuredGamingIndex(cpu.modelName));
  const gpuStanding = standing(gpuIndex(gpu), measuredGpuIndex(gpu.modelName));
  // Separate rankings, not one scale: a CPU at 80% and a GPU at 60% can still be balanced.
  const sentences = [
    `Among CPUs, the ${cpu.modelName} games at ${cpuStanding} of the speed of the fastest in our list. Among graphics cards, the ${gpu.modelName} reaches ${gpuStanding} of the fastest.`,
  ];

  const bestRow = results.find((r) => r.resolution === best);
  if (bestRow) sentences.push(bestSentence(bestRow, cpu, gpu));

  // The best resolution's limit is in its own sentence, so only the others are listed here.
  for (const component of ["CPU", "GPU"] as const) {
    const worst = worstFor(results, component);
    if (worst && worst.resolution !== best) sentences.push(`At ${worst.resolution}, ${unusedClause(worst, cpu, gpu)}.`);
  }
  return sentences;
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
