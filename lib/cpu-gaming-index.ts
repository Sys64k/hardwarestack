import type { CpuOption } from "@/types/hardware";

// CPU gaming performance on one scale: percent of the fastest gaming CPU at 1080p
// (Ryzen 7 9850X3D = 100). Measured figures come from published reviews; CPUs without
// one get an estimate fitted to those figures. The bottleneck model and the upgrade
// ranking both read this, so they agree on which CPU is faster in games.

export interface GamingIndexSource {
  publisher: string;
  title: string;
  url: string;
  gpu: string;
  resolution: string;
  retrieved: string; // YYYY-MM; provenance only, like `title` (not shown on the site)
}

export const TOMS_HARDWARE: GamingIndexSource = {
  publisher: "Tom's Hardware",
  title: "CPU Benchmarks and Hierarchy 2026: Gaming CPU Benchmarks Rankings",
  url: "https://www.tomshardware.com/reviews/cpu-hierarchy,4312.html",
  gpu: "RTX 5090 Founders Edition",
  resolution: "1080p",
  retrieved: "2026-11",
};

// Tom's table has no AM4 CPUs; this fills two of them. Its 4-game average fps at 1080p
// Medium is scaled so its Ryzen 7 9800X3D matches Tom's 97.
const TECHSPOT_SCALING: GamingIndexSource = {
  publisher: "TechSpot",
  title: "Ryzen 7 5800X3D: CPU and GPU Scaling",
  url: "https://www.techspot.com/review/3021-ryzen-7-5800x3d-cpu-gpu-scaling/",
  gpu: "RTX 5090",
  resolution: "1080p Medium, 4-game average",
  retrieved: "2026-11",
};

export const CPU_GAMING_SOURCES: readonly GamingIndexSource[] = [TOMS_HARDWARE, TECHSPOT_SCALING];

// Keyed by the exact `Cpu.modelName`.

const TOMS_FIGURES: Readonly<Record<string, number>> = {
  "AMD Ryzen 7 9850X3D": 100,
  "AMD Ryzen 7 9800X3D": 97,
  "AMD Ryzen 9 9950X3D": 95.7,
  "AMD Ryzen 9 9900X3D": 86.9,
  "AMD Ryzen 7 7800X3D": 85.6,
  "AMD Ryzen 9 7950X3D": 83.9,
  "Intel Core i9-14900K": 78.2,
  "AMD Ryzen 9 7900X3D": 77.1,
  "AMD Ryzen 9 9950X": 76.9,
  "Intel Core i9-13900K": 76.8,
  "Intel Core i7-14700K": 76.4,
  "Intel Core i7-13700K": 75.8,
  "AMD Ryzen 9 9900X": 73.9,
  "Intel Core i5-14600K": 72.8,
  "AMD Ryzen 5 9600X": 72.6,
  "Intel Core Ultra 9 285K": 71.8,
  "AMD Ryzen 9 7950X": 71,
  "Intel Core i5-13600K": 70.9,
  "AMD Ryzen 7 7700X": 70.6,
  "Intel Core Ultra 7 265K": 70.3,
  "AMD Ryzen 9 7900X": 69.2,
  "AMD Ryzen 5 7600X": 67.3,
  "Intel Core Ultra 5 245K": 67.1,
  "Intel Core i7-12700K": 65.8,
  "Intel Core Ultra 5 225": 62.5,
  "Intel Core i5-12600K": 60.8,
};

// TechSpot's fps scaled onto Tom's scale through the CPU both tested, rounded to Tom's
// one decimal.
const TECHSPOT_ANCHOR = "AMD Ryzen 7 9800X3D";
const TECHSPOT_ANCHOR_FPS = 280;
const fromTechSpot = (fps: number) =>
  Math.round((fps / TECHSPOT_ANCHOR_FPS) * TOMS_FIGURES[TECHSPOT_ANCHOR] * 10) / 10;

const TECHSPOT_FIGURES: Readonly<Record<string, number>> = {
  "AMD Ryzen 7 5800X3D": fromTechSpot(198),
  "AMD Ryzen 5 5600": fromTechSpot(155),
};

export const CPU_GAMING_INDEX: Readonly<Record<string, number>> = { ...TOMS_FIGURES, ...TECHSPOT_FIGURES };
export const MEASURED_CPU_COUNT = Object.keys(CPU_GAMING_INDEX).length;

// Same chip at the same clocks as a measured one (KF/F = no iGPU). Non-K parts run
// lower clocks, so they are not aliased and get the estimate instead.
export const CPU_GAMING_ALIASES: Readonly<Record<string, string>> = {
  "Intel Core i9-14900KF": "Intel Core i9-14900K",
  "Intel Core i9-13900KF": "Intel Core i9-13900K",
  "Intel Core i7-14700KF": "Intel Core i7-14700K",
  "Intel Core i7-13700KF": "Intel Core i7-13700K",
  "Intel Core i7-12700KF": "Intel Core i7-12700K",
  "Intel Core i5-14600KF": "Intel Core i5-14600K",
  "Intel Core i5-13600KF": "Intel Core i5-13600K",
  "Intel Core Ultra 7 265KF": "Intel Core Ultra 7 265K",
  "Intel Core Ultra 5 245KF": "Intel Core Ultra 5 245K",
  "Intel Core Ultra 5 225F": "Intel Core Ultra 5 225",
};

// The CPU_GAMING_INDEX key holding this CPU's figure, via an alias if needed.
function measuredName(modelName: string): string | null {
  if (CPU_GAMING_INDEX[modelName] !== undefined) return modelName;
  return CPU_GAMING_ALIASES[modelName] ?? null;
}

export function measuredGamingIndex(modelName: string): number | null {
  const name = measuredName(modelName);
  return name ? CPU_GAMING_INDEX[name] : null;
}

// Which review a CPU's figure comes from; null when it is estimated.
export function gamingIndexSource(modelName: string): GamingIndexSource | null {
  const name = measuredName(modelName);
  if (!name) return null;
  return name in TECHSPOT_FIGURES ? TECHSPOT_SCALING : TOMS_HARDWARE;
}

// Estimate for CPUs without a measured figure: a log-linear fit of the measured CPUs
// against single-core score, X3D cache and the AM4 platform (DDR4, older cores).
// Median error on the measured CPUs: ~5%. Core count barely mattered in the fit; below
// 6 cores a fixed penalty applies, since no measured CPU has fewer.
const FIT_INTERCEPT = 0.9476;
const FIT_SINGLE_EXPONENT = 0.4327;
const FIT_X3D = 0.2354;
const FIT_AM4 = -0.1675;
const FULL_CORE_COUNT = 6;

// AMD's 3D V-Cache parts carry "X3D" in the model name.
function isX3d(cpu: CpuOption): boolean {
  return /X3D/i.test(cpu.modelName);
}

export function estimatedGamingIndex(cpu: CpuOption): number | null {
  if (!cpu.singleCoreScore || cpu.singleCoreScore <= 0) return null;
  const log =
    FIT_INTERCEPT +
    FIT_SINGLE_EXPONENT * Math.log(cpu.singleCoreScore) +
    (isX3d(cpu) ? FIT_X3D : 0) +
    (cpu.socket === "AM4" ? FIT_AM4 : 0);
  const corePenalty = Math.log2(Math.min(cpu.cores, FULL_CORE_COUNT) + 1) / Math.log2(FULL_CORE_COUNT + 1);
  return Math.exp(log) * corePenalty;
}

// Measured figure when there is one, else the estimate; null when neither is possible.
export function gamingIndex(cpu: CpuOption): number | null {
  return measuredGamingIndex(cpu.modelName) ?? estimatedGamingIndex(cpu);
}

// Converts the gaming index into the units of `Gpu.rasterScore`. Set to the median ratio
// of the old single-core × core-count score to the new index across production CPUs, so
// the overall CPU-vs-GPU balance stays where it was while the order between CPUs follows
// measured figures.
export const GAMING_INDEX_TO_SCORE = 150;

// The CPU score the bottleneck model and upgrade ranking use. 0 when the CPU has neither
// a measured figure nor a single-core score.
export function cpuGamingScore(cpu: CpuOption): number {
  return (gamingIndex(cpu) ?? 0) * GAMING_INDEX_TO_SCORE;
}
