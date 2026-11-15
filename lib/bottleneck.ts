import type {
  BottleneckResult,
  CpuOption,
  GpuOption,
  RamOption,
  Resolution,
} from "@/types/hardware";
import { cpuFps } from "./cpu-gaming-index";
import { gpuFps } from "./gpu-gaming-index";

export const RESOLUTIONS: Resolution[] = ["1080p", "1440p", "4K"];

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

// Relative gap between two frame rates, as a percentage of the higher one.
function gapPercent(a: number, b: number): number {
  const max = Math.max(a, b);
  return max > 0 ? (Math.abs(a - b) / max) * 100 : 0;
}

function ramUtilization(ram: RamOption): number {
  const effective = ram.speedMhz * ram.channels;
  // Represents how saturated the RAM bus is relative to a reference system.
  // 80 % is the nominal "healthy" load; slow RAM pushes it to 100 %.
  return Math.round(Math.min(100, (RAM_REFERENCE_SCORE / effective) * 80));
}

export function calculateBottleneck(
  cpu: CpuOption,
  gpu: GpuOption,
  resolution: Resolution,
  ram?: RamOption
): BottleneckResult {
  // Both sides in frames per second: what the CPU allows, and what the GPU renders at this
  // resolution. The lower one sets the frame rate.
  const rawCpuFps = cpuFps(cpu);

  const rf = ram ? ramFactor(ram) : 1.0;
  const ramUtil = ram ? ramUtilization(ram) : 80;

  const effectiveCpuFps = rawCpuFps * rf;
  const effectiveGpuFps = gpuFps(gpu, resolution);

  const max = Math.max(effectiveCpuFps, effectiveGpuFps);
  const fps = Math.min(effectiveCpuFps, effectiveGpuFps);
  const bottleneckPercentage = gapPercent(effectiveCpuFps, effectiveGpuFps);

  if (bottleneckPercentage < BALANCED_THRESHOLD || max === 0) {
    return {
      cpuUtilization: 100,
      gpuUtilization: 100,
      ramUtilization: ramUtil,
      bottleneckComponent: "Balanced",
      bottleneckPercentage,
      fps,
    };
  }

  if (effectiveCpuFps < effectiveGpuFps) {
    const cpuUtil = 100;
    const gpuUtil = Math.round((effectiveCpuFps / effectiveGpuFps) * 100);

    // If the CPU would keep up with the GPU without the RAM penalty (faster than it, or
    // within the balanced threshold), the real culprit is RAM, not the CPU.
    const isRamBottleneck =
      ram !== undefined &&
      rf < 0.95 &&
      (rawCpuFps >= effectiveGpuFps ||
        gapPercent(rawCpuFps, effectiveGpuFps) < BALANCED_THRESHOLD);

    return {
      cpuUtilization: cpuUtil,
      gpuUtilization: gpuUtil,
      ramUtilization: ramUtil,
      bottleneckComponent: isRamBottleneck ? "RAM" : "CPU",
      bottleneckPercentage,
      fps,
    };
  }

  return {
    cpuUtilization: Math.round((effectiveGpuFps / effectiveCpuFps) * 100),
    gpuUtilization: 100,
    ramUtilization: ramUtil,
    bottleneckComponent: "GPU",
    bottleneckPercentage,
    fps,
  };
}
