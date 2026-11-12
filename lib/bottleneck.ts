import type {
  BottleneckResult,
  CpuOption,
  GpuOption,
  RamOption,
  Resolution,
} from "@/types/hardware";
import { GAMING_INDEX_TO_SCORE, measuredGamingIndex } from "./cpu-gaming-index";

export const RESOLUTIONS: Resolution[] = ["1080p", "1440p", "4K"];

const RESOLUTION_PIXEL_RATIO: Record<Resolution, number> = {
  "1080p": 1.0,
  "1440p": 1.78,
  "4K": 4.0,
};

// DDR4-3600 dual channel is the "neutral" baseline — no penalty, no bonus.
const RAM_REFERENCE_SCORE = 7200; // 3600 MHz × 2 channels

// How much slow RAM can reduce the effective CPU score.
// At worst (single DDR4-2133), the CPU gets 25% less than its rated score.
const RAM_MIN_FACTOR = 0.75;

const BALANCED_THRESHOLD = 10;

function ramFactor(ram: RamOption): number {
  const effective = ram.speedMhz * ram.channels;
  const ratio = Math.min(1.0, effective / RAM_REFERENCE_SCORE);
  return RAM_MIN_FACTOR + (1 - RAM_MIN_FACTOR) * ratio;
}

function ramUtilization(ram: RamOption): number {
  const effective = ram.speedMhz * ram.channels;
  // Represents how saturated the RAM bus is relative to a reference system.
  // 80 % is the nominal "healthy" load; slow RAM pushes it to 100 %.
  return Math.round(Math.min(100, (RAM_REFERENCE_SCORE / effective) * 80));
}

// Tier multiplier accounts for architectural advantages (cache bandwidth,
// prefetch efficiency, IPC headroom) that PassMark single-thread doesn't capture.
// An ENTHUSIAST CPU sustains far more FPS in real games than its benchmark implies.
const TIER_CPU_SCALE: Record<string, number> = {
  ENTRY: 1.0,
  MID: 1.1,
  HIGH: 1.25,
  ULTRA: 1.4,
  ENTHUSIAST: 1.6,
};

// Estimated CPU gaming throughput: single-core speed × core-count boost × tier scale.
// log2(cores+1) gives diminishing returns: 4c→2.3×, 8c→3.2×, 16c→4.1×, 24c→4.6×
// Used only for CPUs without a measured figure in lib/cpu-gaming-index.ts.
export function estimatedCpuGamingScore(cpu: CpuOption): number {
  const single = cpu.singleCoreScore ?? 0;
  const coreBoost = Math.log2((cpu.cores ?? 4) + 1);
  const tierScale = TIER_CPU_SCALE[cpu.tier] ?? 1.0;
  return single * coreBoost * tierScale;
}

// Measured review figure when there is one, else the estimate.
export function cpuGamingScore(
  cpu: CpuOption,
  measured: number | null = measuredGamingIndex(cpu.modelName),
  scale: number = GAMING_INDEX_TO_SCORE,
): number {
  return measured !== null && scale > 0 ? measured * scale : estimatedCpuGamingScore(cpu);
}

export function calculateBottleneck(
  cpu: CpuOption,
  gpu: GpuOption,
  resolution: Resolution,
  ram?: RamOption
): BottleneckResult {
  const rawCpuScore = cpuGamingScore(cpu);
  const gpuBaseScore = gpu.rasterScore ?? 0;

  const rf = ram ? ramFactor(ram) : 1.0;
  const ramUtil = ram ? ramUtilization(ram) : 80;

  const effectiveCpuScore = rawCpuScore * rf;
  const effectiveGpuScore = gpuBaseScore / RESOLUTION_PIXEL_RATIO[resolution];

  const max = Math.max(effectiveCpuScore, effectiveGpuScore);
  const bottleneckPercentage =
    max > 0
      ? (Math.abs(effectiveCpuScore - effectiveGpuScore) / max) * 100
      : 0;

  if (bottleneckPercentage < BALANCED_THRESHOLD || max === 0) {
    return {
      cpuUtilization: 100,
      gpuUtilization: 100,
      ramUtilization: ramUtil,
      bottleneckComponent: "Balanced",
      bottleneckPercentage,
    };
  }

  if (effectiveCpuScore < effectiveGpuScore) {
    const cpuUtil = 100;
    const gpuUtil = Math.round((effectiveCpuScore / effectiveGpuScore) * 100);

    // If the RAM penalty is significant enough that removing it would tip the
    // balance in the CPU's favour, the real culprit is RAM, not the CPU.
    const isRamBottleneck =
      ram !== undefined && rf < 0.95 && rawCpuScore / rf >= effectiveGpuScore;

    return {
      cpuUtilization: cpuUtil,
      gpuUtilization: gpuUtil,
      ramUtilization: ramUtil,
      bottleneckComponent: isRamBottleneck ? "RAM" : "CPU",
      bottleneckPercentage,
    };
  }

  return {
    cpuUtilization: Math.round((effectiveGpuScore / effectiveCpuScore) * 100),
    gpuUtilization: 100,
    ramUtilization: ramUtil,
    bottleneckComponent: "GPU",
    bottleneckPercentage,
  };
}
