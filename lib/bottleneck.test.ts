import { describe, it, expect } from "vitest";
import { calculateBottleneck, cpuGamingScore, estimatedCpuGamingScore } from "./bottleneck";
import { measuredGamingIndex } from "./cpu-gaming-index";
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
  retailLinks: [],
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
  retailLinks: [],
  ...overrides,
});

const ram = (overrides: Partial<RamOption> = {}): RamOption => ({
  id: "ram-1",
  modelName: "Test RAM",
  type: "DDR4",
  speedMhz: 3600,
  capacityGb: 32,
  channels: 2,
  latencyCl: 16,
  tier: "HIGH",
  retailLinks: [],
  ...overrides,
});

describe("calculateBottleneck", () => {
  it("returns Balanced when CPU and GPU are closely matched", () => {
    // cpuGamingScore = 2000 * log2(9) * 1.1 ≈ 6968, effectiveGpu at 1080p = 7500
    // gap ≈ 7.1% — within the 10% balanced threshold
    const result = calculateBottleneck(cpu(), gpu(), "1080p");
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
    // cpuGamingScore (HIGH, 2200, 8c) = 2200 * log2(9) * 1.25 ≈ 8716
    // slowRam rf = 0.75 + 0.25 * (2133/7200) ≈ 0.824
    // effectiveCpu = 8716 * 0.824 ≈ 7182
    // rawCpu / rf = 8716 / 0.824 ≈ 10577
    // GPU score must be between 7182 and 10577 for RAM bottleneck to trigger
    const strongGpu = gpu({ rasterScore: 9000 });
    const strongCpu = cpu({ tier: "HIGH", singleCoreScore: 2200, cores: 8 });
    const slowRam = ram({ speedMhz: 2133, channels: 1 }); // worst case: single-channel DDR4-2133
    const result = calculateBottleneck(strongCpu, strongGpu, "1080p", slowRam);
    expect(result.bottleneckComponent).toBe("RAM");
  });

  it("RAM at reference speed applies no penalty", () => {
    const refRam = ram({ speedMhz: 3600, channels: 2 }); // DDR4-3600 dual = reference
    const withRam = calculateBottleneck(cpu(), gpu({ rasterScore: 5000 }), "1080p", refRam);
    const withoutRam = calculateBottleneck(cpu(), gpu({ rasterScore: 5000 }), "1080p");
    expect(withRam.bottleneckComponent).toBe(withoutRam.bottleneckComponent);
    expect(withRam.cpuUtilization).toBe(withoutRam.cpuUtilization);
  });

  it("bottleneckPercentage is 0 when scores are equal", () => {
    // Construct a GPU score that exactly matches CPU gaming score
    // cpuGamingScore = 2000 * log2(9) * 1.1 ≈ 6971
    const result = calculateBottleneck(
      cpu({ singleCoreScore: 2000, cores: 8, tier: "MID" }),
      gpu({ rasterScore: 6971 }),
      "1080p"
    );
    expect(result.bottleneckPercentage).toBeLessThan(1);
    expect(result.bottleneckComponent).toBe("Balanced");
  });
});

describe("cpuGamingScore", () => {
  it("uses the measured figure times the scale when there is one", () => {
    expect(cpuGamingScore(cpu(), 80, 100)).toBe(8000);
  });

  it("falls back to the estimate without a measured figure", () => {
    const c = cpu();
    expect(cpuGamingScore(c, null, 100)).toBe(estimatedCpuGamingScore(c));
  });

  it("falls back to the estimate while the scale is not calibrated", () => {
    const c = cpu();
    expect(cpuGamingScore(c, 80, 0)).toBe(estimatedCpuGamingScore(c));
  });
});

describe("measuredGamingIndex", () => {
  const index = { "Intel Core i5-14600K": 90 };
  const aliases = { "Intel Core i5-14600KF": "Intel Core i5-14600K" };

  it("reads a listed CPU", () => {
    expect(measuredGamingIndex("Intel Core i5-14600K", index, aliases)).toBe(90);
  });

  it("reads an alias through to its measured equivalent", () => {
    expect(measuredGamingIndex("Intel Core i5-14600KF", index, aliases)).toBe(90);
  });

  it("returns null for an unlisted CPU", () => {
    expect(measuredGamingIndex("Intel Core i5-14600", index, aliases)).toBeNull();
  });
});
