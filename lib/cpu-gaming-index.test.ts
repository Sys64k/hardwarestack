import { describe, it, expect } from "vitest";
import {
  CPU_GAMING_ALIASES,
  CPU_GAMING_INDEX,
  estimatedGamingIndex,
  CPU_GAMING_SOURCES,
  GAMING_INDEX_TO_SCORE,
  cpuGamingScore,
  TOMS_HARDWARE,
  gamingIndex,
  gamingIndexSource,
  measuredGamingIndex,
} from "./cpu-gaming-index";
import type { CpuOption } from "@/types/hardware";

const cpu = (o: Partial<CpuOption> = {}): CpuOption => ({
  id: "c",
  vendor: "AMD",
  modelName: "Test CPU",
  tier: "MID",
  socket: "AM5",
  cores: 8,
  threads: 16,
  boostClockGhz: 5,
  singleCoreScore: 2000,
  retailLinks: [],
  ...o,
});

describe("measuredGamingIndex", () => {
  it("reads a listed CPU", () => {
    expect(measuredGamingIndex("Intel Core i5-14600K")).toBe(72.8);
  });

  it("reads an alias through to its measured equivalent", () => {
    expect(measuredGamingIndex("Intel Core i5-14600KF")).toBe(72.8);
  });

  it("returns null for an unlisted CPU", () => {
    expect(measuredGamingIndex("Intel Core i5-14600")).toBeNull();
  });

  it("scales TechSpot figures onto Tom's scale through the 9800X3D", () => {
    expect(measuredGamingIndex("AMD Ryzen 7 5800X3D")).toBe(68.6);
  });
});

describe("CPU_GAMING_ALIASES", () => {
  it("only points at CPUs that have a measured figure", () => {
    for (const target of Object.values(CPU_GAMING_ALIASES)) expect(CPU_GAMING_INDEX[target]).toBeDefined();
  });

  it("never aliases a CPU that is itself measured", () => {
    for (const name of Object.keys(CPU_GAMING_ALIASES)) expect(CPU_GAMING_INDEX[name]).toBeUndefined();
  });
});

describe("estimatedGamingIndex", () => {
  it("returns null without a usable single-core score", () => {
    expect(estimatedGamingIndex(cpu({ singleCoreScore: null }))).toBeNull();
    expect(estimatedGamingIndex(cpu({ singleCoreScore: 0 }))).toBeNull();
  });

  it("rises with single-core score", () => {
    expect(estimatedGamingIndex(cpu({ singleCoreScore: 2200 }))!).toBeGreaterThan(estimatedGamingIndex(cpu())!);
  });

  it("adds the X3D cache and subtracts for AM4", () => {
    const base = estimatedGamingIndex(cpu())!;
    expect(estimatedGamingIndex(cpu({ modelName: "Ryzen 7 X3D" }))!).toBeGreaterThan(base);
    expect(estimatedGamingIndex(cpu({ socket: "AM4" }))!).toBeLessThan(base);
  });

  it("penalises fewer than 6 cores but not more than 6", () => {
    const six = estimatedGamingIndex(cpu({ cores: 6 }))!;
    expect(estimatedGamingIndex(cpu({ cores: 4 }))!).toBeLessThan(six);
    expect(estimatedGamingIndex(cpu({ cores: 16 }))).toBe(six);
  });

  it("lands near the measured figure for a reviewed CPU", () => {
    // Ryzen 7 7700X with its production single-core score
    const est = estimatedGamingIndex(cpu({ modelName: "x", singleCoreScore: 1950 }))!;
    expect(est / CPU_GAMING_INDEX["AMD Ryzen 7 7700X"]).toBeGreaterThan(0.9);
    expect(est / CPU_GAMING_INDEX["AMD Ryzen 7 7700X"]).toBeLessThan(1.1);
  });
});

describe("gamingIndex", () => {
  it("prefers the measured figure over the estimate", () => {
    expect(gamingIndex(cpu({ modelName: "AMD Ryzen 7 9800X3D" }))).toBe(97);
  });

  it("falls back to the estimate", () => {
    const c = cpu();
    expect(gamingIndex(c)).toBe(estimatedGamingIndex(c));
  });

  it("is null when neither is available", () => {
    expect(gamingIndex(cpu({ singleCoreScore: null }))).toBeNull();
  });
});

describe("gamingIndexSource", () => {
  it("names the review for a measured CPU and its alias", () => {
    expect(gamingIndexSource("Intel Core i5-14600K")).toBe(TOMS_HARDWARE);
    expect(gamingIndexSource("Intel Core i5-14600KF")).toBe(TOMS_HARDWARE);
    expect(gamingIndexSource("AMD Ryzen 7 5800X3D")).toBe(CPU_GAMING_SOURCES[1]);
  });

  it("is null for an estimated CPU", () => {
    expect(gamingIndexSource("Intel Core i5-12400")).toBeNull();
  });
});

describe("cpuGamingScore", () => {
  it("uses the measured figure for a reviewed CPU", () => {
    const measured = cpu({ modelName: "AMD Ryzen 7 9800X3D", singleCoreScore: 1 });
    expect(cpuGamingScore(measured)).toBe(97 * GAMING_INDEX_TO_SCORE);
  });

  it("uses the estimate for an unreviewed CPU", () => {
    const c = cpu();
    expect(cpuGamingScore(c)).toBe((estimatedGamingIndex(c) ?? 0) * GAMING_INDEX_TO_SCORE);
  });

  it("is 0 without a measured figure or single-core score", () => {
    expect(cpuGamingScore(cpu({ singleCoreScore: null }))).toBe(0);
  });

  it("ranks an X3D chip above a many-core chip, as reviews do", () => {
    const x3d = cpu({ modelName: "AMD Ryzen 7 9800X3D" });
    const manyCore = cpu({ modelName: "Intel Core i9-14900K" });
    expect(cpuGamingScore(x3d)).toBeGreaterThan(cpuGamingScore(manyCore));
  });
});
