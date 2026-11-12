// Measured gaming performance per CPU, from a published review's relative-performance chart.
// When a CPU is listed here, the bottleneck model uses this figure instead of its
// single-core × core-count estimate, which overrates many-core chips and ignores X3D cache.

export interface GamingIndexSource {
  publisher: string;
  title: string;
  url: string;
  gpu: string;
  resolution: string;
  published: string; // YYYY-MM
}

export const CPU_GAMING_SOURCE: GamingIndexSource | null = null;

// Relative 1080p gaming performance in percent, keyed by the exact `Cpu.modelName`.
// Values are copied from the source chart as published.
export const CPU_GAMING_INDEX: Readonly<Record<string, number>> = {};

// CPUs that are the same chip at the same clocks as a measured one (e.g. KF = K without
// the iGPU). Only exact equivalents: a non-K part has lower clocks and is not aliased.
export const CPU_GAMING_ALIASES: Readonly<Record<string, string>> = {};

// Converts the chart's percent into the bottleneck model's CPU score units. Set by
// calibrating against the formula on the measured CPUs, so CPU-vs-GPU balance stays put.
export const GAMING_INDEX_TO_SCORE = 0;

export function measuredGamingIndex(
  modelName: string,
  index: Readonly<Record<string, number>> = CPU_GAMING_INDEX,
  aliases: Readonly<Record<string, string>> = CPU_GAMING_ALIASES,
): number | null {
  return index[modelName] ?? index[aliases[modelName] ?? ""] ?? null;
}
