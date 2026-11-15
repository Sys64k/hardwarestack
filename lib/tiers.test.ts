import { describe, it, expect } from "vitest";
import {
  CPU_TIER_FLOORS,
  GPU_TIER_FLOORS,
  TIERS_HIGHEST_FIRST,
  byCpuGamingScore,
  byGpuGamingScore,
  cpuGamingTier,
  gpuGamingTier,
  TIER_ORDER,
  TIER_RANK,
  gpuTargetResolution,
  groupByTier,
  tierFromIndex,
  withCpuGamingTier,
  withGpuGamingTier,
  tierRepresentatives,
} from "./tiers";
import type { CpuOption, GpuOption, TierType } from "@/types/hardware";

const cpu = (modelName: string, o: Partial<CpuOption> = {}): CpuOption => ({
  id: modelName,
  vendor: "AMD",
  modelName,
  tier: "MID",
  socket: "AM5",
  cores: 8,
  threads: 16,
  boostClockGhz: 5,
  singleCoreScore: 2000,
  ...o,
});

const gpu = (modelName: string, o: Partial<GpuOption> = {}): GpuOption => ({
  id: modelName,
  vendor: "NVIDIA",
  modelName,
  tier: "MID",
  vramGb: 12,
  memoryBandwidthGbs: 500,
  rasterScore: 10000,
  ...o,
});

describe("tierFromIndex", () => {
  it("puts each floor in its own tier and just below it in the next one down", () => {
    expect(tierFromIndex(GPU_TIER_FLOORS.ENTHUSIAST, GPU_TIER_FLOORS)).toBe("ENTHUSIAST");
    expect(tierFromIndex(GPU_TIER_FLOORS.ENTHUSIAST - 0.1, GPU_TIER_FLOORS)).toBe("ULTRA");
    expect(tierFromIndex(GPU_TIER_FLOORS.ULTRA - 0.1, GPU_TIER_FLOORS)).toBe("HIGH");
    expect(tierFromIndex(GPU_TIER_FLOORS.HIGH - 0.1, GPU_TIER_FLOORS)).toBe("MID");
    expect(tierFromIndex(GPU_TIER_FLOORS.MID - 0.1, GPU_TIER_FLOORS)).toBe("ENTRY");
  });

  it("is ENTRY for a part with no score", () => {
    expect(tierFromIndex(0, CPU_TIER_FLOORS)).toBe("ENTRY");
  });
});

describe("gpuGamingTier", () => {
  it("matches the reference cards the scraper's tier rules name", () => {
    const expected: [string, TierType][] = [
      ["NVIDIA GeForce RTX 4090", "ENTHUSIAST"],
      ["AMD Radeon RX 7900 XTX", "ENTHUSIAST"],
      ["NVIDIA GeForce RTX 4080", "ULTRA"],
      ["NVIDIA GeForce RTX 3080", "ULTRA"],
      ["NVIDIA GeForce RTX 4070", "HIGH"],
      ["NVIDIA GeForce RTX 3070", "HIGH"],
      ["NVIDIA GeForce RTX 4060", "MID"],
      ["NVIDIA GeForce RTX 3060", "MID"],
      ["AMD Radeon RX 7600", "MID"],
    ];
    for (const [name, tier] of expected) expect([name, gpuGamingTier(gpu(name))]).toEqual([name, tier]);
  });

  it("ignores the stored tier", () => {
    expect(gpuGamingTier(gpu("NVIDIA GeForce RTX 4090", { tier: "ENTRY" }))).toBe("ENTHUSIAST");
  });
});

describe("cpuGamingTier", () => {
  it("ranks by gaming speed, not product segment", () => {
    const expected: [string, TierType, Partial<CpuOption>][] = [
      ["AMD Ryzen 7 9800X3D", "ENTHUSIAST", {}],
      ["Intel Core i9-14900K", "ULTRA", { socket: "LGA1700" }],
      ["AMD Ryzen 7 7700X", "HIGH", {}],
      ["AMD Ryzen 9 5950X", "ENTRY", { socket: "AM4" }],
    ];
    for (const [name, tier, o] of expected) expect([name, cpuGamingTier(cpu(name, o))]).toEqual([name, tier]);
  });

  it("ignores the stored tier", () => {
    expect(cpuGamingTier(cpu("AMD Ryzen 7 9800X3D", { tier: "ENTRY" }))).toBe("ENTHUSIAST");
  });
});

describe("byCpuGamingScore / byGpuGamingScore", () => {
  it("sorts fastest first without changing the input", () => {
    const cpus = [cpu("AMD Ryzen 7 7700X"), cpu("AMD Ryzen 7 9800X3D")];
    expect(byCpuGamingScore(cpus).map((c) => c.modelName)).toEqual(["AMD Ryzen 7 9800X3D", "AMD Ryzen 7 7700X"]);
    expect(cpus[0].modelName).toBe("AMD Ryzen 7 7700X");
    const gpus = [gpu("NVIDIA GeForce RTX 4060"), gpu("NVIDIA GeForce RTX 4090")];
    expect(byGpuGamingScore(gpus).map((g) => g.modelName)).toEqual(["NVIDIA GeForce RTX 4090", "NVIDIA GeForce RTX 4060"]);
    expect(gpus[0].modelName).toBe("NVIDIA GeForce RTX 4060");
  });
});

describe("groupByTier", () => {
  const items: { name: string; tier: TierType }[] = [
    { name: "a", tier: "HIGH" },
    { name: "b", tier: "ENTRY" },
    { name: "c", tier: "HIGH" },
  ];

  it("groups lowest tier first by default, keeping item order and skipping empty tiers", () => {
    expect(groupByTier(items, (i) => i.tier)).toEqual([
      { tier: "ENTRY", items: [items[1]] },
      { tier: "HIGH", items: [items[0], items[2]] },
    ]);
  });

  it("follows the order it is given", () => {
    expect(groupByTier(items, (i) => i.tier, TIERS_HIGHEST_FIRST).map((g) => g.tier)).toEqual(["HIGH", "ENTRY"]);
  });

  it("is empty for no items", () => {
    expect(groupByTier([], (i: { tier: TierType }) => i.tier)).toEqual([]);
  });
});

describe("tierRepresentatives", () => {
  it("takes the first item of each tier, lowest tier first", () => {
    const gpus = byGpuGamingScore([
      gpu("NVIDIA GeForce RTX 4060"),
      gpu("NVIDIA GeForce RTX 4090"),
      gpu("NVIDIA GeForce RTX 3060"),
      gpu("NVIDIA GeForce RTX 5090"),
    ]);
    expect(tierRepresentatives(gpus, gpuGamingTier).map((g) => g.modelName)).toEqual([
      "NVIDIA GeForce RTX 4060",
      "NVIDIA GeForce RTX 5090",
    ]);
  });
});

describe("TIER_RANK", () => {
  it("follows TIER_ORDER", () => {
    TIER_ORDER.forEach((tier, i) => expect(TIER_RANK[tier]).toBe(i));
  });
});

describe("withCpuGamingTier / withGpuGamingTier", () => {
  it("sorts fastest first and adds the gaming tier, keeping the stored tier", () => {
    const [x3d, slow] = withCpuGamingTier([cpu("AMD Ryzen 9 5950X", { socket: "AM4", tier: "ENTHUSIAST" }), cpu("AMD Ryzen 7 9800X3D", { tier: "HIGH" })]);
    expect(x3d).toMatchObject({ modelName: "AMD Ryzen 7 9800X3D", tier: "HIGH", gamingTier: "ENTHUSIAST" });
    expect(slow).toMatchObject({ modelName: "AMD Ryzen 9 5950X", tier: "ENTHUSIAST", gamingTier: "ENTRY" });
    const [g] = withGpuGamingTier([gpu("NVIDIA GeForce RTX 4060"), gpu("NVIDIA GeForce RTX 4090")]);
    expect(g).toMatchObject({ modelName: "NVIDIA GeForce RTX 4090", gamingTier: "ENTHUSIAST" });
  });
});

describe("gpuTargetResolution", () => {
  it("maps each tier to the resolution it is built for", () => {
    expect(TIER_ORDER.map(gpuTargetResolution)).toEqual(["1080p", "1080p", "1440p", "4K", "4K"]);
  });
});
