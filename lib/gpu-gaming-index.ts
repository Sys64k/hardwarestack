import type { GpuOption } from "@/types/hardware";

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

// Converts the index onto the score scale shared with the CPU score, which was the old
// `rasterScore` (PassMark × 0.51) scale. Set to the median ratio of rasterScore to the
// index across the measured production GPUs, so the overall CPU-vs-GPU balance stays where
// it was while the order between GPUs follows measured figures. `rasterScore` itself is now
// only the input to the estimate, never used to rank GPUs.
export const GPU_GAMING_INDEX_TO_SCORE = 268;

// The GPU score the bottleneck model and upgrade ranking use. 0 when the GPU has neither
// a measured figure nor a raster score.
export function gpuGamingScore(gpu: GpuOption): number {
  return (gpuIndex(gpu) ?? 0) * GPU_GAMING_INDEX_TO_SCORE;
}
