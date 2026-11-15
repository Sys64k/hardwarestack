import { describe, it, expect } from "vitest";
import {
  GPU_GAMING_ALIASES,
  GPU_GAMING_INDEX,
  GPU_GAMING_INDEX_TO_SCORE,
  TOMS_GPU_HIERARCHY,
  estimatedGpuIndex,
  gpuGamingScore,
  gpuIndex,
  gpuIndexSource,
  measuredGpuIndex,
} from "./gpu-gaming-index";
import type { GpuOption } from "@/types/hardware";

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
  it("scales the index into score units", () => {
    expect(gpuGamingScore(gpu({ modelName: "NVIDIA GeForce RTX 5090" }))).toBe(100 * GPU_GAMING_INDEX_TO_SCORE);
  });

  it("is 0 when the GPU has neither a figure nor a raster score", () => {
    expect(gpuGamingScore(gpu({ rasterScore: null }))).toBe(0);
  });
});
