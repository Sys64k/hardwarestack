import { QUANT_LEVELS } from "./llm-models";
import type { GpuOption, RamOption } from "@/types/hardware";
import type { LlmModel, QuantId } from "@/types/local-ai";

// Capacities are GiB: a "24 GB" card has 24 GiB. Bandwidths are decimal GB/s.
const BYTES_PER_GIB = 1024 ** 3;

// The constants below are fitted to the speeds measured on the test machine
// (lib/measured-llm-speed.ts), including which runs Ollama kept entirely in VRAM; the
// tolerance is enforced in lib/measured-llm-speed.test.ts. One card can't tell desktop
// VRAM from runtime buffers, so the desktop share is the measured figure and the runtime
// overhead takes the rest.

// VRAM the desktop and driver hold before a model loads (2 GB measured on the test
// machine). A fixed amount, not a share: a screen takes the same on an 8 GB card as on a
// 24 GB one.
export const DESKTOP_VRAM_GIB = 2;

// Share of system RAM free for a model once the OS and apps have theirs.
export const USABLE_RAM_FRACTION = 0.75;

// CUDA/ROCm context and compute buffers on top of weights + KV cache: a base plus a share
// of the weights, so a small model on an 8 GB card doesn't pay a 14B model's buffers.
export const RUNTIME_OVERHEAD_BASE_GIB = 0.2;
export const RUNTIME_OVERHEAD_WEIGHT_SHARE = 0.05;

// Token generation is memory-bound: every token reads all active weights once. Real
// runtimes reach a fraction of the theoretical bandwidth, plus a fixed per-token cost
// (kernel launches, sampling) that dominates for small models. Mixture-of-experts models
// reach less of the GPU's bandwidth: expert routing and many small matrix multiplies.
export const GPU_BANDWIDTH_EFFICIENCY = 0.72;
export const MOE_GPU_BANDWIDTH_EFFICIENCY = 0.59;
export const RAM_BANDWIDTH_EFFICIENCY = 0.79;
export const PER_TOKEN_OVERHEAD_SECONDS = 0.001;

export type GpuSpec = Pick<GpuOption, "vramGb" | "memoryBandwidthGbs">;
export type SystemRamSpec = Pick<RamOption, "capacityGb" | "speedMhz" | "channels">;

export type FitStatus = "gpu" | "partial" | "none";

export interface MemoryEstimate {
  weightsGib: number;
  kvCacheGib: number;
  overheadGib: number;
  totalGib: number;
}

export interface FitInput {
  model: LlmModel;
  quant: QuantId;
  contextTokens: number;
  gpu: GpuSpec;
  ram: SystemRamSpec | null;
}

export interface FitResult {
  status: FitStatus;
  memory: MemoryEstimate;
  usableVramGib: number;
  gpuWeightShare: number;         // fraction of the weights held in VRAM, 0–1
  tokensPerSecond: number | null; // null when it won't run or bandwidth is unknown
}

export function bitsPerWeight(model: LlmModel, quant: QuantId): number {
  if (!model.quants.includes(quant)) {
    throw new Error(`${model.name} is not available as ${quant}`);
  }
  return model.quantBitsOverride?.[quant] ?? QUANT_LEVELS[quant].bitsPerWeight;
}

function kvCacheBytes(model: LlmModel, contextTokens: number): number {
  const full = model.kvBytesPerToken * contextTokens;
  const window = model.slidingWindowKv;
  const sliding = window
    ? window.bytesPerToken * Math.min(contextTokens, window.windowTokens)
    : 0;
  return full + sliding;
}

export function estimateMemory(
  model: LlmModel,
  quant: QuantId,
  contextTokens: number
): MemoryEstimate {
  const ctx = Math.min(contextTokens, model.maxContextTokens);
  const weightsGib = (model.paramsB * 1e9 * bitsPerWeight(model, quant)) / 8 / BYTES_PER_GIB;
  const kvCacheGib = kvCacheBytes(model, ctx) / BYTES_PER_GIB;
  const overheadGib = RUNTIME_OVERHEAD_BASE_GIB + RUNTIME_OVERHEAD_WEIGHT_SHARE * weightsGib;
  return { weightsGib, kvCacheGib, overheadGib, totalGib: weightsGib + kvCacheGib + overheadGib };
}

// Theoretical bandwidth in GB/s: MT/s × 8 bytes per 64-bit channel.
function ramBandwidthGbs(ram: SystemRamSpec): number {
  return (ram.speedMhz * 8 * ram.channels) / 1000;
}

// Mixture-of-experts models list the parameters they read per token; dense ones don't.
export function isMixtureOfExperts(model: LlmModel): boolean {
  return model.activeParamsB !== null;
}

export function gpuBandwidthEfficiency(model: LlmModel): number {
  return isMixtureOfExperts(model) ? MOE_GPU_BANDWIDTH_EFFICIENCY : GPU_BANDWIDTH_EFFICIENCY;
}

function estimateTokensPerSecond(
  model: LlmModel,
  quant: QuantId,
  gpuWeightShare: number,
  gpu: GpuSpec,
  ram: SystemRamSpec | null
): number | null {
  if (gpu.memoryBandwidthGbs === null) return null;
  const activeGb = ((model.activeParamsB ?? model.paramsB) * bitsPerWeight(model, quant)) / 8;
  let seconds =
    (activeGb * gpuWeightShare) / (gpu.memoryBandwidthGbs * gpuBandwidthEfficiency(model));
  if (gpuWeightShare < 1) {
    if (!ram) return null;
    seconds +=
      (activeGb * (1 - gpuWeightShare)) / (ramBandwidthGbs(ram) * RAM_BANDWIDTH_EFFICIENCY);
  }
  return 1 / (seconds + PER_TOKEN_OVERHEAD_SECONDS);
}

export function checkFit({ model, quant, contextTokens, gpu, ram }: FitInput): FitResult {
  const memory = estimateMemory(model, quant, contextTokens);
  const usableVramGib = Math.max(0, gpu.vramGb - DESKTOP_VRAM_GIB);
  const usableRamGib = ram ? ram.capacityGb * USABLE_RAM_FRACTION : 0;

  // KV cache and runtime buffers stay on the GPU; whatever weights don't fit spill to RAM.
  const vramForWeights = usableVramGib - memory.kvCacheGib - memory.overheadGib;
  const gpuWeightShare = Math.min(1, Math.max(0, vramForWeights / memory.weightsGib));
  const spillGib = Math.max(0, memory.totalGib - usableVramGib);

  const status: FitStatus =
    spillGib === 0 ? "gpu" : spillGib <= usableRamGib ? "partial" : "none";

  return {
    status,
    memory,
    usableVramGib,
    gpuWeightShare,
    tokensPerSecond:
      status === "none" ? null : estimateTokensPerSecond(model, quant, gpuWeightShare, gpu, ram),
  };
}

// Smallest advertised VRAM size (whole GB) that runs the model entirely on the GPU,
// including the DESKTOP_VRAM_GIB a screen-driving card has already used.
export function minVramGb(model: LlmModel, quant: QuantId, contextTokens: number): number {
  return Math.ceil(estimateMemory(model, quant, contextTokens).totalGib + DESKTOP_VRAM_GIB);
}

export interface QuantRecommendation {
  quant: QuantId;
  fit: FitResult;
}

// Highest-quality quantisation that runs entirely on the GPU; failing that, the
// smallest one, since it offloads the least to system RAM.
export function recommendQuant(
  model: LlmModel,
  contextTokens: number,
  gpu: GpuSpec,
  ram: SystemRamSpec | null
): QuantRecommendation {
  const byQuality = [...model.quants].sort(
    (a, b) => bitsPerWeight(model, b) - bitsPerWeight(model, a)
  );
  const options = byQuality.map((quant) => ({
    quant,
    fit: checkFit({ model, quant, contextTokens, gpu, ram }),
  }));
  return options.find((o) => o.fit.status === "gpu") ?? options[options.length - 1];
}
