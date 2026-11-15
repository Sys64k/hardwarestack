import { describe, it, expect } from "vitest";
import {
  GPU_GAMING_ALIASES,
  GPU_GAMING_INDEX,
  GPU_1080P_FACTOR,
  GPU_4K_FACTOR,
  GPU_GAMING_INDEX_1080P,
  GPU_GAMING_INDEX_4K,
  RTX_5090_FPS_1080P,
  gpuFps,
  TOMS_GPU_HIERARCHY,
  estimatedGpuIndex,
  gpuGamingScore,
  gpuIndex,
  gpuIndexSource,
  measuredGpuIndex,
} from "./gpu-gaming-index";
import { cpuFps } from "./cpu-gaming-index";
import type { CpuOption, GpuOption } from "@/types/hardware";

const gpu = (o: Partial<GpuOption> = {}): GpuOption => ({
  id: "g",
  vendor: "NVIDIA",
  modelName: "Test GPU",
  tier: "MID",
  vramGb: 8,
  memoryBandwidthGbs: 288,
  rasterScore: 12000,
  ...o,
});

describe("measuredGpuIndex", () => {
  it("reads a listed GPU", () => {
    expect(measuredGpuIndex("AMD Radeon RX 9070 XT")).toBe(69.7);
  });

  it("reads an alias through to its measured equivalent", () => {
    expect(measuredGpuIndex("NVIDIA GeForce RTX 5090 D")).toBe(100);
    expect(measuredGpuIndex("NVIDIA GeForce RTX 3060")).toBe(25);
  });

  it("returns null for an unlisted GPU", () => {
    expect(measuredGpuIndex("NVIDIA GeForce RTX 4090 D")).toBeNull();
  });
});

describe("GPU_GAMING_ALIASES", () => {
  it("only points at GPUs that have a measured figure", () => {
    for (const target of Object.values(GPU_GAMING_ALIASES)) expect(GPU_GAMING_INDEX[target]).toBeDefined();
  });

  it("never aliases a GPU that is itself measured", () => {
    for (const name of Object.keys(GPU_GAMING_ALIASES)) expect(GPU_GAMING_INDEX[name]).toBeUndefined();
  });
});

describe("GPU_GAMING_INDEX", () => {
  it("is relative to the RTX 5090 and stays within 0–100", () => {
    expect(GPU_GAMING_INDEX["NVIDIA GeForce RTX 5090"]).toBe(100);
    for (const v of Object.values(GPU_GAMING_INDEX)) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("fixes PassMark's order where reviews disagree", () => {
    expect(GPU_GAMING_INDEX["AMD Radeon RX 9070 XT"]).toBeGreaterThan(GPU_GAMING_INDEX["NVIDIA GeForce RTX 4070 SUPER"]);
    expect(GPU_GAMING_INDEX["AMD Radeon RX 7900 XTX"]).toBeGreaterThan(GPU_GAMING_INDEX["NVIDIA GeForce RTX 4070 Ti"]);
  });
});

describe("estimatedGpuIndex", () => {
  it("returns null without a usable raster score", () => {
    expect(estimatedGpuIndex(gpu({ rasterScore: null }))).toBeNull();
    expect(estimatedGpuIndex(gpu({ rasterScore: 0 }))).toBeNull();
  });

  it("rises with raster score", () => {
    expect(estimatedGpuIndex(gpu({ rasterScore: 14000 }))!).toBeGreaterThan(estimatedGpuIndex(gpu())!);
  });

  it("lands near the measured figure for a reviewed GPU", () => {
    // RX 6800 XT with its production raster score
    const ratio = estimatedGpuIndex(gpu({ rasterScore: 12795 }))! / GPU_GAMING_INDEX["AMD Radeon RX 6800 XT"];
    expect(ratio).toBeGreaterThan(0.9);
    expect(ratio).toBeLessThan(1.1);
  });
});

describe("gpuIndex", () => {
  it("prefers the measured figure over the estimate", () => {
    expect(gpuIndex(gpu({ modelName: "NVIDIA GeForce RTX 4070", rasterScore: 1 }))).toBe(46.5);
  });

  it("falls back to the estimate, then to null", () => {
    expect(gpuIndex(gpu())).toBe(estimatedGpuIndex(gpu()));
    expect(gpuIndex(gpu({ rasterScore: null }))).toBeNull();
  });
});

describe("gpuIndexSource", () => {
  it("credits Tom's Hardware for measured and aliased GPUs", () => {
    expect(gpuIndexSource("NVIDIA GeForce RTX 4070")).toBe(TOMS_GPU_HIERARCHY);
    expect(gpuIndexSource("NVIDIA GeForce RTX 5090 D v2")).toBe(TOMS_GPU_HIERARCHY);
  });

  it("returns null for an estimated GPU", () => {
    expect(gpuIndexSource("AMD Radeon RX 6800")).toBeNull();
  });
});

describe("gpuGamingScore", () => {
  it("is the gaming index, for ranking", () => {
    expect(gpuGamingScore(gpu({ modelName: "NVIDIA GeForce RTX 5090" }))).toBe(100);
  });

  it("is 0 when the GPU has neither a figure nor a raster score", () => {
    expect(gpuGamingScore(gpu({ rasterScore: null }))).toBe(0);
  });
});

describe("GPU_GAMING_INDEX_1080P / GPU_GAMING_INDEX_4K", () => {
  it("cover exactly the GPUs with a 1440p figure", () => {
    const keys = Object.keys(GPU_GAMING_INDEX).sort();
    expect(Object.keys(GPU_GAMING_INDEX_1080P).sort()).toEqual(keys);
    expect(Object.keys(GPU_GAMING_INDEX_4K).sort()).toEqual(keys);
  });
});

describe("gpuFps", () => {
  const rtx5090 = gpu({ modelName: "NVIDIA GeForce RTX 5090" });

  it("converts the 1440p index to fps", () => {
    expect(gpuFps(rtx5090, "1440p")).toBeCloseTo(167.3, 5);
  });

  it("at 1080p, never goes below what the 1440p figure implies", () => {
    // The 5090's measured 1080p (203.8 fps) hit the test CPU's limit.
    expect(gpuFps(rtx5090, "1080p")).toBeCloseTo(167.3 * GPU_1080P_FACTOR, 5);
  });

  it("at 1080p, uses the measured figure when it is higher", () => {
    // The RX 6600's 1440p result is unusually low; its measured 1080p is 51.9 fps.
    expect(gpuFps(gpu({ modelName: "AMD Radeon RX 6600" }), "1080p")).toBeCloseTo(51.9, 0);
  });

  it("uses the measured 4K figure, which catches 8 GB cards running out of VRAM", () => {
    const card = gpu({ modelName: "NVIDIA GeForce RTX 5060 Ti 8GB" });
    expect(gpuFps(card, "4K")).toBeCloseTo(28.1, 1);
    expect(gpuFps(card, "4K")).toBeLessThan(gpuFps(card, "1440p") * GPU_4K_FACTOR);
  });

  it("reads 1080p and 4K figures through an alias", () => {
    const d = gpu({ modelName: "NVIDIA GeForce RTX 5090 D" });
    expect(gpuFps(d, "4K")).toBe(gpuFps(rtx5090, "4K"));
    expect(gpuFps(d, "1080p")).toBe(gpuFps(rtx5090, "1080p"));
  });

  it("scales an unreviewed GPU by the median factors", () => {
    const g = gpu();
    expect(gpuFps(g, "1080p")).toBeCloseTo(gpuFps(g, "1440p") * GPU_1080P_FACTOR, 5);
    expect(gpuFps(g, "4K")).toBeCloseTo(gpuFps(g, "1440p") * GPU_4K_FACTOR, 5);
  });

  it("is 0 without a figure or raster score", () => {
    expect(gpuFps(gpu({ rasterScore: null }), "4K")).toBe(0);
  });
});

// The review measured every GPU at 1080p on a Ryzen 7 9800X3D. The model's frame rate for
// that pair (the lower of the CPU's and the GPU's) should land near each measurement; this
// fails if CPU_FPS_PER_INDEX_POINT or GPU_1080P_FACTOR drift from the data.
describe("calibration against the review's 1080p results", () => {
  const x3d: CpuOption = {
    id: "c", vendor: "AMD", modelName: "AMD Ryzen 7 9800X3D", tier: "HIGH", socket: "AM5",
    cores: 8, threads: 16, boostClockGhz: 5.2, singleCoreScore: null,
  };

  it("predicts every reviewed GPU's 1080p frame rate on the 9800X3D within 12%", () => {
    for (const [name, index] of Object.entries(GPU_GAMING_INDEX_1080P)) {
      const measured = (index * RTX_5090_FPS_1080P) / 100;
      const predicted = Math.min(cpuFps(x3d), gpuFps(gpu({ modelName: name }), "1080p"));
      expect(Math.abs(predicted / measured - 1), name).toBeLessThan(0.12);
    }
  });
});
