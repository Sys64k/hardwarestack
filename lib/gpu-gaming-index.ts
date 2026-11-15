import type { GpuOption, Resolution } from "@/types/hardware";

// GPU gaming performance on one scale: percent of the fastest gaming GPU at 1440p Ultra
// (GeForce RTX 5090 = 100). Measured figures come from a published review; GPUs without
// one get an estimate fitted to those figures. 1440p is mostly GPU-bound without
// penalising 8 GB cards the way 4K does. The bottleneck model and the upgrade ranking
// both read this, so they agree on which GPU is faster in games.

export interface GpuIndexSource {
  publisher: string;
  title: string;
  url: string;
  cpu: string; // the review's test CPU
  resolution: string;
  retrieved: string; // YYYY-MM; provenance only, like `title` (not shown on the site)
}

export const TOMS_GPU_HIERARCHY: GpuIndexSource = {
  publisher: "Tom's Hardware",
  title: "GPU Benchmarks Hierarchy 2026: Rasterization Performance",
  url: "https://www.tomshardware.com/reviews/gpu-hierarchy,4388.html",
  cpu: "Ryzen 7 9800X3D",
  resolution: "1440p Ultra",
  retrieved: "2026-11",
};

// Keyed by the exact `Gpu.modelName`.
export const GPU_GAMING_INDEX: Readonly<Record<string, number>> = {
  "NVIDIA GeForce RTX 5090": 100,
  "NVIDIA GeForce RTX 4090": 85.7,
  "NVIDIA GeForce RTX 5080": 76.7,
  "AMD Radeon RX 7900 XTX": 73.1,
  "NVIDIA GeForce RTX 4080 SUPER": 70.9,
  "NVIDIA GeForce RTX 4080": 70.3,
  "NVIDIA GeForce RTX 5070 Ti": 69.8,
  "AMD Radeon RX 9070 XT": 69.7,
  "AMD Radeon RX 7900 XT": 64.6,
  "NVIDIA GeForce RTX 4070 Ti SUPER": 62.1,
  "AMD Radeon RX 9070": 62.1,
  "NVIDIA GeForce RTX 3090 Ti": 59.7,
  "NVIDIA GeForce RTX 4070 Ti": 58.6,
  "NVIDIA GeForce RTX 5070": 57.6,
  "NVIDIA GeForce RTX 3090": 54.7,
  "NVIDIA GeForce RTX 4070 SUPER": 54.5,
  "AMD Radeon RX 6950 XT": 53.5,
  "NVIDIA GeForce RTX 3080 Ti": 53.3,
  "AMD Radeon RX 9070 GRE": 51.8,
  "AMD Radeon RX 7800 XT": 50.7,
  "AMD Radeon RX 6900 XT": 50.2,
  "NVIDIA GeForce RTX 3080": 49,
  "AMD Radeon RX 6800 XT": 47.6,
  "NVIDIA GeForce RTX 4070": 46.5,
  "NVIDIA GeForce RTX 5060 Ti 16GB": 43.9,
  "AMD Radeon RX 7700 XT": 43.4,
  "NVIDIA GeForce RTX 5060 Ti 8GB": 41,
  "AMD Radeon RX 9060 XT 16GB": 40.2,
  "NVIDIA GeForce RTX 3070 Ti": 40,
  "AMD Radeon RX 9060 XT 8GB": 37.3,
  "NVIDIA GeForce RTX 4060 Ti 16GB": 36.2,
  "NVIDIA GeForce RTX 5060": 35.8,
  "NVIDIA GeForce RTX 4060 Ti": 35.2, // Tom's "RTX 4060 Ti 8GB"
  "NVIDIA GeForce RTX 3070": 34.8,
  "AMD Radeon RX 6750 XT": 34.4,
  "AMD Radeon RX 6700 XT": 32.5,
  "NVIDIA GeForce RTX 3060 Ti": 30.5,
  "Intel Arc B580": 30.3,
  "AMD Radeon RX 7600 XT": 30,
  "NVIDIA GeForce RTX 4060": 28.4,
  "AMD Radeon RX 7600": 27.2,
  "NVIDIA GeForce RTX 5050": 27.1,
  "Intel Arc B570": 26.5,
  "NVIDIA GeForce RTX 3060 12GB": 25,
  "AMD Radeon RX 6600 XT": 24.3,
  "AMD Radeon RX 6650 XT": 22.7,
  "NVIDIA GeForce RTX 3050": 17.8,
  "AMD Radeon RX 6600": 14.9,
};

// The same review's 1080p Ultra figures (RTX 5090 = 100, at 203.8 fps), keyed like
// GPU_GAMING_INDEX and in its order (the review's 1440p order). The top cards here are held
// back by the review's CPU, so gpuFps never uses one below what the 1440p figure implies.
export const GPU_GAMING_INDEX_1080P: Readonly<Record<string, number>> = {
  "NVIDIA GeForce RTX 5090": 100,
  "NVIDIA GeForce RTX 4090": 90.1,
  "NVIDIA GeForce RTX 5080": 81.9,
  "AMD Radeon RX 7900 XTX": 79.3,
  "NVIDIA GeForce RTX 4080 SUPER": 78,
  "NVIDIA GeForce RTX 4080": 77.2,
  "NVIDIA GeForce RTX 5070 Ti": 76.2,
  "AMD Radeon RX 9070 XT": 76.9,
  "AMD Radeon RX 7900 XT": 71.3,
  "NVIDIA GeForce RTX 4070 Ti SUPER": 69.3,
  "AMD Radeon RX 9070": 69.1,
  "NVIDIA GeForce RTX 3090 Ti": 64.7,
  "NVIDIA GeForce RTX 4070 Ti": 66.3,
  "NVIDIA GeForce RTX 5070": 65.1,
  "NVIDIA GeForce RTX 3090": 60.3,
  "NVIDIA GeForce RTX 4070 SUPER": 62.2,
  "AMD Radeon RX 6950 XT": 60.5,
  "NVIDIA GeForce RTX 3080 Ti": 58.7,
  "AMD Radeon RX 9070 GRE": 59.2,
  "AMD Radeon RX 7800 XT": 58.1,
  "AMD Radeon RX 6900 XT": 57.4,
  "NVIDIA GeForce RTX 3080": 54.8,
  "AMD Radeon RX 6800 XT": 54.9,
  "NVIDIA GeForce RTX 4070": 54.7,
  "NVIDIA GeForce RTX 5060 Ti 16GB": 51.6,
  "AMD Radeon RX 7700 XT": 50.5,
  "NVIDIA GeForce RTX 5060 Ti 8GB": 49.3,
  "AMD Radeon RX 9060 XT 16GB": 48.2,
  "NVIDIA GeForce RTX 3070 Ti": 46.4,
  "AMD Radeon RX 9060 XT 8GB": 45.7,
  "NVIDIA GeForce RTX 4060 Ti 16GB": 43.8,
  "NVIDIA GeForce RTX 5060": 43.4,
  "NVIDIA GeForce RTX 4060 Ti": 43.2,
  "NVIDIA GeForce RTX 3070": 42.8,
  "AMD Radeon RX 6750 XT": 40.8,
  "AMD Radeon RX 6700 XT": 38.9,
  "NVIDIA GeForce RTX 3060 Ti": 36.4,
  "Intel Arc B580": 35.1,
  "AMD Radeon RX 7600 XT": 50.1,
  "NVIDIA GeForce RTX 4060": 35.1,
  "AMD Radeon RX 7600": 34.3,
  "NVIDIA GeForce RTX 5050": 34,
  "Intel Arc B570": 31.1,
  "NVIDIA GeForce RTX 3060 12GB": 30.2,
  "AMD Radeon RX 6600 XT": 30.8,
  "AMD Radeon RX 6650 XT": 31.5,
  "NVIDIA GeForce RTX 3050": 21.9,
  "AMD Radeon RX 6600": 25.5,
};

// The same review's 4K Ultra figures (RTX 5090 = 100), keyed and ordered like
// GPU_GAMING_INDEX. 4K gets its own figures because cards scale differently there: the
// biggest GPUs pull ahead, and 8 GB cards run out of VRAM (the RTX 5060 Ti 8GB falls from 41
// at 1440p to 25 at 4K).
export const GPU_GAMING_INDEX_4K: Readonly<Record<string, number>> = {
  "NVIDIA GeForce RTX 5090": 100,
  "NVIDIA GeForce RTX 4090": 80.4,
  "NVIDIA GeForce RTX 5080": 69.8,
  "AMD Radeon RX 7900 XTX": 63.7,
  "NVIDIA GeForce RTX 4080 SUPER": 62.6,
  "NVIDIA GeForce RTX 4080": 60.9,
  "NVIDIA GeForce RTX 5070 Ti": 61.9,
  "AMD Radeon RX 9070 XT": 59.4,
  "AMD Radeon RX 7900 XT": 54,
  "NVIDIA GeForce RTX 4070 Ti SUPER": 52.8,
  "AMD Radeon RX 9070": 52.1,
  "NVIDIA GeForce RTX 3090 Ti": 53.5,
  "NVIDIA GeForce RTX 4070 Ti": 48.6,
  "NVIDIA GeForce RTX 5070": 49,
  "NVIDIA GeForce RTX 3090": 47.9,
  "NVIDIA GeForce RTX 4070 SUPER": 44.4,
  "AMD Radeon RX 6950 XT": 43.6,
  "NVIDIA GeForce RTX 3080 Ti": 46,
  "AMD Radeon RX 9070 GRE": 41.8,
  "AMD Radeon RX 7800 XT": 40.7,
  "AMD Radeon RX 6900 XT": 40.5,
  "NVIDIA GeForce RTX 3080": 39.6,
  "AMD Radeon RX 6800 XT": 38.1,
  "NVIDIA GeForce RTX 4070": 37.2,
  "NVIDIA GeForce RTX 5060 Ti 16GB": 36.3,
  "AMD Radeon RX 7700 XT": 34.3,
  "NVIDIA GeForce RTX 5060 Ti 8GB": 25.4,
  "AMD Radeon RX 9060 XT 16GB": 31.7,
  "NVIDIA GeForce RTX 3070 Ti": 23.5,
  "AMD Radeon RX 9060 XT 8GB": 26.8,
  "NVIDIA GeForce RTX 4060 Ti 16GB": 28.2,
  "NVIDIA GeForce RTX 5060": 19.6,
  "NVIDIA GeForce RTX 4060 Ti": 21.5,
  "NVIDIA GeForce RTX 3070": 23.6,
  "AMD Radeon RX 6750 XT": 26.7,
  "AMD Radeon RX 6700 XT": 25.3,
  "NVIDIA GeForce RTX 3060 Ti": 17.5,
  "Intel Arc B580": 24.9,
  "AMD Radeon RX 7600 XT": 23.1,
  "NVIDIA GeForce RTX 4060": 15.7,
  "AMD Radeon RX 7600": 16.6,
  "NVIDIA GeForce RTX 5050": 15.4,
  "Intel Arc B570": 17.7,
  "NVIDIA GeForce RTX 3060 12GB": 20,
  "AMD Radeon RX 6600 XT": 15.6,
  "AMD Radeon RX 6650 XT": 17.1,
  "NVIDIA GeForce RTX 3050": 11.4,
  "AMD Radeon RX 6600": 13.1,
};

export const MEASURED_GPU_COUNT = Object.keys(GPU_GAMING_INDEX).length;

// Same gaming performance as a measured card. The plain RTX 3060 is the 12 GB card; the
// China-market 5090 D models keep the 5090's shaders and clocks (they're cut back for AI,
// not games). The 4090 D has fewer shaders than the 4090, so it gets the estimate.
export const GPU_GAMING_ALIASES: Readonly<Record<string, string>> = {
  "NVIDIA GeForce RTX 3060": "NVIDIA GeForce RTX 3060 12GB",
  "NVIDIA GeForce RTX 5090 D": "NVIDIA GeForce RTX 5090",
  "NVIDIA GeForce RTX 5090 D v2": "NVIDIA GeForce RTX 5090",
};

// The GPU_GAMING_INDEX key holding this GPU's figure, via an alias if needed.
function measuredName(modelName: string): string | null {
  if (GPU_GAMING_INDEX[modelName] !== undefined) return modelName;
  return GPU_GAMING_ALIASES[modelName] ?? null;
}

export function measuredGpuIndex(modelName: string): number | null {
  const name = measuredName(modelName);
  return name ? GPU_GAMING_INDEX[name] : null;
}

// The review a GPU's figure comes from; null when it is estimated.
export function gpuIndexSource(modelName: string): GpuIndexSource | null {
  return measuredName(modelName) ? TOMS_GPU_HIERARCHY : null;
}

// Estimate for GPUs without a measured figure: a log-linear fit of the measured GPUs
// against their PassMark-derived `rasterScore`. Median error on the measured GPUs: ~8%.
const FIT_INTERCEPT = -10.9391;
const FIT_RASTER_EXPONENT = 1.5644;

export function estimatedGpuIndex(gpu: GpuOption): number | null {
  if (!gpu.rasterScore || gpu.rasterScore <= 0) return null;
  return Math.exp(FIT_INTERCEPT + FIT_RASTER_EXPONENT * Math.log(gpu.rasterScore));
}

// Measured figure when there is one, else the estimate; null when neither is possible.
export function gpuIndex(gpu: GpuOption): number | null {
  return measuredGpuIndex(gpu.modelName) ?? estimatedGpuIndex(gpu);
}

// Frame rates, from the same review (Ryzen 7 9800X3D testbed): the RTX 5090 averages 203.8
// fps at 1080p, 167.3 at 1440p and 110.8 at 4K Ultra, so index points convert to fps.
export const RTX_5090_FPS_1080P = 203.8;
export const RTX_5090_FPS_1440P = 167.3;
export const RTX_5090_FPS_4K = 110.8;

// How frame rates change with resolution, as the median across the review's GPUs that the
// CPU doesn't hold back (40–110 fps at 1440p): 1080p runs 1.43× the 1440p frame rate and 4K
// 0.53×. Far less than the pixel counts (2.25× apart for 1440p → 4K), since much of a frame's
// work doesn't scale with resolution. Used where a GPU has no figure at that resolution, and
// at 1080p also as a floor for the top cards, whose measured 1080p figure hit the CPU's limit.
export const GPU_1080P_FACTOR = 1.43;
export const GPU_4K_FACTOR = 0.53;

// A figure on the review's scale (RTX 5090 = 100) as fps, given the 5090's fps there.
function fpsFromIndex(index: number, rtx5090Fps: number): number {
  return (index * rtx5090Fps) / 100;
}

function gpuFps1080p(name: string | null, fps1440: number): number {
  const scaled = fps1440 * GPU_1080P_FACTOR;
  const measured = name ? GPU_GAMING_INDEX_1080P[name] : undefined;
  if (measured === undefined) return scaled;
  // The top cards' measured 1080p hit the review CPU's limit, so never go below the scaled
  // figure; cards whose 1440p result is unusually low keep their higher measured one.
  return Math.max(fpsFromIndex(measured, RTX_5090_FPS_1080P), scaled);
}

function gpuFps4k(name: string | null, fps1440: number): number {
  const measured = name ? GPU_GAMING_INDEX_4K[name] : undefined;
  return measured === undefined ? fps1440 * GPU_4K_FACTOR : fpsFromIndex(measured, RTX_5090_FPS_4K);
}

// The frame rate this GPU alone allows at a resolution, with no CPU limit. 0 when the GPU
// has neither a measured figure nor a raster score.
export function gpuFps(gpu: GpuOption, resolution: Resolution): number {
  // The 1440p figure is the base: every GPU has one (measured or estimated).
  const fps1440 = fpsFromIndex(gpuIndex(gpu) ?? 0, RTX_5090_FPS_1440P);
  if (resolution === "1440p") return fps1440;
  const name = measuredName(gpu.modelName);
  return resolution === "1080p" ? gpuFps1080p(name, fps1440) : gpuFps4k(name, fps1440);
}

// Ranks GPUs for upgrades and related links. Deliberately just the gaming index (0 without
// one); the bottleneck model uses gpuFps.
export function gpuGamingScore(gpu: GpuOption): number {
  return gpuIndex(gpu) ?? 0;
}
