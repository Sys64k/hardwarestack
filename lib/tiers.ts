import { cpuGamingScore } from "./cpu-gaming-index";
import { gpuGamingScore } from "./gpu-gaming-index";
import type { CpuOption, GpuOption, Resolution, TierType } from "@/types/hardware";

// Lowest to highest.
export const TIER_ORDER: readonly TierType[] = ["ENTRY", "MID", "HIGH", "ULTRA", "ENTHUSIAST"];
export const TIERS_HIGHEST_FIRST: readonly TierType[] = [...TIER_ORDER].reverse();

export const TIER_RANK = Object.fromEntries(TIER_ORDER.map((tier, i) => [tier, i])) as Record<TierType, number>;

export const TIER_LABELS: Record<TierType, string> = {
  ENTRY: "Entry",
  MID: "Mid-Range",
  HIGH: "High-End",
  ULTRA: "Ultra",
  ENTHUSIAST: "Enthusiast",
};

export const TIER_COLORS: Record<TierType, string> = {
  ENTRY: "bg-slate-100 text-slate-600",
  MID: "bg-blue-50 text-blue-700",
  HIGH: "bg-violet-50 text-violet-700",
  ULTRA: "bg-amber-50 text-amber-700",
  ENTHUSIAST: "bg-red-50 text-red-700",
};

// The tier a part is shown in, from its gaming index rather than the stored `tier`.
// The stored tier is the product segment the scraper assigned (an i9 is ENTHUSIAST however
// it games), and it only drives the sitemap rule in pair-pages.ts, where price class is the
// point. Each value is the lowest index in that tier, highest tier first; below the last
// one is ENTRY.
interface TierFloors {
  ENTHUSIAST: number;
  ULTRA: number;
  HIGH: number;
  MID: number;
}

// CPU index: 1080p gaming as a % of the fastest gaming CPU. Enthusiast is the current X3D
// chips; Ultra the fastest Raptor Lake i7/i9s and Zen 4/5 Ryzen 9s; High the current
// six- and eight-core chips; Mid Alder Lake i5s; Entry AM4 without X3D and quad-cores.
export const CPU_TIER_FLOORS: TierFloors = { ENTHUSIAST: 85, ULTRA: 74, HIGH: 68, MID: 60 };

// GPU index: 1440p gaming as a % of the RTX 5090. Anchored on the reference cards the
// scraper's tier rules name: RTX 4090 / RX 7900 XTX Enthusiast, RTX 3080 / 4080 Ultra,
// RTX 3070 / 4070 High, RTX 3060 / 4060 / RX 7600 Mid.
export const GPU_TIER_FLOORS: TierFloors = { ENTHUSIAST: 72, ULTRA: 48, HIGH: 33, MID: 20 };

export function tierFromIndex(index: number, floors: TierFloors): TierType {
  if (index >= floors.ENTHUSIAST) return "ENTHUSIAST";
  if (index >= floors.ULTRA) return "ULTRA";
  if (index >= floors.HIGH) return "HIGH";
  if (index >= floors.MID) return "MID";
  return "ENTRY";
}

export function cpuGamingTier(cpu: CpuOption): TierType {
  return tierFromIndex(cpuGamingScore(cpu), CPU_TIER_FLOORS);
}

export function gpuGamingTier(gpu: GpuOption): TierType {
  return tierFromIndex(gpuGamingScore(gpu), GPU_TIER_FLOORS);
}

// Fastest for gaming first; new arrays, the inputs are left alone.
export function byCpuGamingScore<T extends CpuOption>(cpus: T[]): T[] {
  return [...cpus].sort((a, b) => cpuGamingScore(b) - cpuGamingScore(a));
}

export function byGpuGamingScore<T extends GpuOption>(gpus: T[]): T[] {
  return [...gpus].sort((a, b) => gpuGamingScore(b) - gpuGamingScore(a));
}

// A part with the tier it is shown in. Kept apart from the stored `tier` so the two
// can't be mixed up.
export type WithGamingTier<T> = T & { gamingTier: TierType };

// Fastest for gaming first, each with its gaming tier: what lists and dropdowns show.
export function withCpuGamingTier<T extends CpuOption>(cpus: T[]): WithGamingTier<T>[] {
  return byCpuGamingScore(cpus).map((cpu) => ({ ...cpu, gamingTier: cpuGamingTier(cpu) }));
}

export function withGpuGamingTier<T extends GpuOption>(gpus: T[]): WithGamingTier<T>[] {
  return byGpuGamingScore(gpus).map((gpu) => ({ ...gpu, gamingTier: gpuGamingTier(gpu) }));
}

// The resolution a GPU tier is built for, for the GPU page's one-line summary.
export function gpuTargetResolution(tier: TierType): Resolution {
  if (tier === "ENTRY" || tier === "MID") return "1080p";
  if (tier === "HIGH") return "1440p";
  return "4K";
}

// Items grouped in the given tier order, keeping only tiers that have items.
export function groupByTier<T>(
  items: T[],
  tierOf: (item: T) => TierType,
  order: readonly TierType[] = TIER_ORDER
): { tier: TierType; items: T[] }[] {
  return order
    .map((tier) => ({ tier, items: items.filter((i) => tierOf(i) === tier) }))
    .filter((g) => g.items.length > 0);
}

// The first item of each tier, lowest tier first: pass items sorted best first to get the
// fastest part in each tier.
export function tierRepresentatives<T>(items: T[], tierOf: (item: T) => TierType): T[] {
  return groupByTier(items, tierOf).map((g) => g.items[0]);
}
