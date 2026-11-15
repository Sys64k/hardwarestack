import { describe, it, expect } from "vitest";
import { calculateBottleneck } from "./bottleneck";
import { cpuFps } from "./cpu-gaming-index";
import { gpuFps } from "./gpu-gaming-index";
import type { CpuOption, GpuOption, RamOption } from "@/types/hardware";

const cpu = (overrides: Partial<CpuOption> = {}): CpuOption => ({
  id: "cpu-1",
  vendor: "INTEL",
  modelName: "Test CPU",
  tier: "MID",
  socket: "LGA1700",
  cores: 8,
  threads: 16,
  boostClockGhz: 5.0,
  singleCoreScore: 2000,
  ...overrides,
});

const gpu = (overrides: Partial<GpuOption> = {}): GpuOption => ({
  id: "gpu-1",
  vendor: "NVIDIA",
  modelName: "Test GPU",
  tier: "MID",
  vramGb: 8,
  memoryBandwidthGbs: 288,
  rasterScore: 7500,
  ...overrides,
});

// An unreviewed GPU that renders `fps` at 1080p (bisection on rasterScore, which the
// estimate rises with).
const gpuAtFps = (fps: number): GpuOption => {
  let lo = 1;
  let hi = 100_000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (gpuFps(gpu({ rasterScore: mid }), "1080p") < fps) lo = mid;
    else hi = mid;
  }
  return gpu({ rasterScore: (lo + hi) / 2 });
};

const ram = (overrides: Partial<RamOption> = {}): RamOption => ({
  id: "ram-1",
  modelName: "Test RAM",
  type: "DDR4",
  speedMhz: 3600,
  capacityGb: 32,
  channels: 2,
  latencyCl: 16,
  tier: "HIGH",
  ...overrides,
});

describe("calculateBottleneck", () => {
  it("returns Balanced when CPU and GPU are closely matched", () => {
    // GPU 7% above the CPU's frame rate: within the 10% balanced threshold
    const result = calculateBottleneck(cpu(), gpuAtFps(cpuFps(cpu()) * 1.07), "1080p");
    expect(result.bottleneckComponent).toBe("Balanced");
    expect(result.bottleneckPercentage).toBeLessThan(10);
  });

  it("detects GPU bottleneck when GPU score is much lower than CPU", () => {
    const weakGpu = gpu({ rasterScore: 3000 });
    const strongCpu = cpu({ tier: "ENTHUSIAST", singleCoreScore: 2400, cores: 16 });
    const result = calculateBottleneck(strongCpu, weakGpu, "1080p");
    expect(result.bottleneckComponent).toBe("GPU");
    expect(result.gpuUtilization).toBe(100);
    expect(result.cpuUtilization).toBeLessThan(100);
  });

  it("detects CPU bottleneck when CPU score is much lower than GPU", () => {
    const strongGpu = gpu({ rasterScore: 18000 });
    const weakCpu = cpu({ tier: "ENTRY", singleCoreScore: 1200, cores: 4 });
    const result = calculateBottleneck(weakCpu, strongGpu, "1080p");
    expect(result.bottleneckComponent).toBe("CPU");
    expect(result.cpuUtilization).toBe(100);
    expect(result.gpuUtilization).toBeLessThan(100);
  });

  it("shifts toward GPU bottleneck at higher resolutions", () => {
    const strongCpu = cpu({ tier: "ENTHUSIAST", singleCoreScore: 2400, cores: 16 });
    const midGpu = gpu({ rasterScore: 9000 });
    const result1080 = calculateBottleneck(strongCpu, midGpu, "1080p");
    const result4K = calculateBottleneck(strongCpu, midGpu, "4K");
    // At 4K the GPU is much more constrained — should be GPU bottleneck or more balanced
    expect(["GPU", "Balanced"]).toContain(result4K.bottleneckComponent);
    // GPU utilization should be lower (more strained) at 4K than at 1080p
    expect(result4K.gpuUtilization).toBeLessThanOrEqual(result1080.gpuUtilization);
  });

  it("detects RAM bottleneck when single-channel slow RAM limits the CPU", () => {
    // slowRam rf = 0.75 + 0.25 * (2133/7200) ≈ 0.824, so the effective CPU score is
    // 0.824 × raw. A GPU at raw × 1.0 sits between effective and raw / rf: the CPU only
    // falls short because of the RAM.
    const strongCpu = cpu({ tier: "HIGH", singleCoreScore: 2200, cores: 8 });
    const strongGpu = gpuAtFps(cpuFps(strongCpu));
    const slowRam = ram({ speedMhz: 2133, channels: 1 }); // worst case: single-channel DDR4-2133
    const result = calculateBottleneck(strongCpu, strongGpu, "1080p", slowRam);
    expect(result.bottleneckComponent).toBe("RAM");
  });

  it("blames RAM when the CPU, without the RAM penalty, is within the balanced threshold", () => {
    // Raw CPU 5% short of the GPU: balanced without the penalty, so the RAM is the culprit
    const slowRam = ram({ speedMhz: 2133, channels: 1 });
    const result = calculateBottleneck(cpu(), gpuAtFps(cpuFps(cpu()) / 0.95), "1080p", slowRam);
    expect(result.bottleneckComponent).toBe("RAM");
  });

  it("blames the CPU when it falls short even without the RAM penalty", () => {
    // Raw CPU 15% short of the GPU (rf ≈ 0.824 so raw / rf would wrongly clear it)
    const slowRam = ram({ speedMhz: 2133, channels: 1 });
    const result = calculateBottleneck(cpu(), gpuAtFps(cpuFps(cpu()) / 0.85), "1080p", slowRam);
    expect(result.bottleneckComponent).toBe("CPU");
  });

  it("blames the CPU, not mildly slow RAM, when the penalty is under 5%", () => {
    // DDR4-3200 dual: rf ≈ 0.972, too small to call RAM the bottleneck
    const result = calculateBottleneck(cpu(), gpuAtFps(cpuFps(cpu()) * 1.5), "1080p", ram({ speedMhz: 3200 }));
    expect(result.bottleneckComponent).toBe("CPU");
  });

  it("RAM at reference speed applies no penalty", () => {
    const refRam = ram({ speedMhz: 3600, channels: 2 }); // DDR4-3600 dual = reference
    const withRam = calculateBottleneck(cpu(), gpu({ rasterScore: 5000 }), "1080p", refRam);
    const withoutRam = calculateBottleneck(cpu(), gpu({ rasterScore: 5000 }), "1080p");
    expect(withRam.bottleneckComponent).toBe(withoutRam.bottleneckComponent);
    expect(withRam.cpuUtilization).toBe(withoutRam.cpuUtilization);
  });

  it("uses the measured figure for a reviewed GPU, whatever its raster score", () => {
    const reviewed = gpu({ modelName: "NVIDIA GeForce RTX 5090", rasterScore: 1 });
    const matched = calculateBottleneck(cpu(), reviewed, "1080p");
    const sameScore = calculateBottleneck(cpu(), gpuAtFps(gpuFps(reviewed, "1080p")), "1080p");
    expect(matched.bottleneckPercentage).toBeCloseTo(sameScore.bottleneckPercentage, 5);
  });

  it("reports the lower of the CPU's and GPU's frame rates, after the RAM penalty", () => {
    const slowGpu = gpuAtFps(cpuFps(cpu()) / 2);
    expect(calculateBottleneck(cpu(), slowGpu, "1080p").fps).toBeCloseTo(cpuFps(cpu()) / 2, 0);
    const fastGpu = gpuAtFps(cpuFps(cpu()) * 2);
    expect(calculateBottleneck(cpu(), fastGpu, "1080p").fps).toBeCloseTo(cpuFps(cpu()), 5);
    const slowRam = ram({ speedMhz: 2133, channels: 1 });
    expect(calculateBottleneck(cpu(), fastGpu, "1080p", slowRam).fps).toBeLessThan(cpuFps(cpu()));
  });

  it("bottleneckPercentage is 0 when scores are equal", () => {
    const result = calculateBottleneck(cpu(), gpuAtFps(cpuFps(cpu())), "1080p");
    expect(result.bottleneckPercentage).toBeLessThan(1);
    expect(result.bottleneckComponent).toBe("Balanced");
  });
});
