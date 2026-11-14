import { describe, it, expect } from "vitest";
import {
  bestResolution,
  hasScores,
  hasReviewFigures,
  isSitemapPair,
  pairHref,
  pairPath,
  pairResults,
  pairSummary,
  pairSlug,
  pairVerdict,
  parsePairSlug,
  relatedCpus,
  relatedGpus,
  sitemapPairs,
  worstBottleneck,
  type ResolutionResult,
} from "./pair-pages";
import type { BottleneckComponent, CpuOption, GpuOption, Resolution } from "@/types/hardware";

const cpu = (overrides: Partial<CpuOption> = {}): CpuOption => ({
  id: "cpu-1",
  vendor: "AMD",
  modelName: "AMD Ryzen 5 5600",
  tier: "MID",
  socket: "AM4",
  cores: 6,
  threads: 12,
  boostClockGhz: 4.4,
  singleCoreScore: 3300,
  retailLinks: [],
  ...overrides,
});

const gpu = (overrides: Partial<GpuOption> = {}): GpuOption => ({
  id: "gpu-1",
  vendor: "NVIDIA",
  modelName: "NVIDIA GeForce RTX 4070",
  tier: "HIGH",
  vramGb: 12,
  memoryBandwidthGbs: 504,
  rasterScore: 26000,
  retailLinks: [],
  ...overrides,
});

const row = (
  resolution: Resolution,
  bottleneckComponent: BottleneckComponent,
  bottleneckPercentage: number
): ResolutionResult => ({
  resolution,
  result: {
    cpuUtilization: 100,
    gpuUtilization: 100,
    ramUtilization: 80,
    bottleneckComponent,
    bottleneckPercentage,
  },
});

describe("pairSlug / pairPath", () => {
  it("joins both model slugs with -vs-", () => {
    expect(pairSlug("AMD Ryzen 5 5600", "NVIDIA GeForce RTX 4070")).toBe(
      "amd-ryzen-5-5600-vs-nvidia-geforce-rtx-4070"
    );
    expect(pairPath("Intel Core i5-13400F", "AMD Radeon RX 7800 XT")).toBe(
      "/bottleneck/intel-core-i5-13400f-vs-amd-radeon-rx-7800-xt"
    );
  });
});

describe("parsePairSlug", () => {
  const cpus = [cpu(), cpu({ id: "cpu-2", modelName: "AMD Ryzen 5 5600X" })];
  const gpus = [gpu(), gpu({ id: "gpu-2", modelName: "NVIDIA GeForce RTX 4070 Super" })];

  it("round-trips a slug built by pairSlug", () => {
    const slug = pairSlug("AMD Ryzen 5 5600X", "NVIDIA GeForce RTX 4070 Super");
    const match = parsePairSlug(slug, cpus, gpus);
    expect(match?.cpu.id).toBe("cpu-2");
    expect(match?.gpu.id).toBe("gpu-2");
  });

  it("does not confuse a CPU whose slug is a prefix of another", () => {
    const match = parsePairSlug("amd-ryzen-5-5600-vs-nvidia-geforce-rtx-4070", cpus, gpus);
    expect(match?.cpu.id).toBe("cpu-1");
    expect(match?.gpu.id).toBe("gpu-1");
  });

  it("handles a model name that itself contains 'vs'", () => {
    const odd = cpu({ id: "cpu-vs", modelName: "Chip vs Edition" });
    const match = parsePairSlug(pairSlug(odd.modelName, gpus[0].modelName), [odd], gpus);
    expect(match?.cpu.id).toBe("cpu-vs");
  });

  it("returns null for unknown parts or a malformed slug", () => {
    expect(parsePairSlug("amd-ryzen-5-5600-vs-unknown-gpu", cpus, gpus)).toBeNull();
    expect(parsePairSlug("unknown-cpu-vs-nvidia-geforce-rtx-4070", cpus, gpus)).toBeNull();
    expect(parsePairSlug("amd-ryzen-5-5600", cpus, gpus)).toBeNull();
    expect(parsePairSlug("", cpus, gpus)).toBeNull();
  });
});

describe("pairHref", () => {
  it("links scored pairs and skips unscored ones", () => {
    expect(pairHref(cpu(), gpu())).toBe("/bottleneck/amd-ryzen-5-5600-vs-nvidia-geforce-rtx-4070");
    expect(pairHref(cpu({ singleCoreScore: null }), gpu())).toBeNull();
    expect(pairHref(cpu(), gpu({ rasterScore: null }))).toBeNull();
  });
});

describe("hasScores / isSitemapPair", () => {
  it("requires both benchmark scores", () => {
    expect(hasScores(cpu(), gpu())).toBe(true);
    expect(hasScores(cpu({ singleCoreScore: null }), gpu())).toBe(false);
    expect(hasScores(cpu(), gpu({ rasterScore: null }))).toBe(false);
  });

  it("includes pairs at most one tier apart", () => {
    expect(isSitemapPair(cpu({ tier: "MID" }), gpu({ tier: "MID" }))).toBe(true);
    expect(isSitemapPair(cpu({ tier: "MID" }), gpu({ tier: "HIGH" }))).toBe(true);
    expect(isSitemapPair(cpu({ tier: "HIGH" }), gpu({ tier: "MID" }))).toBe(true);
    expect(isSitemapPair(cpu({ tier: "ENTRY" }), gpu({ tier: "HIGH" }))).toBe(false);
    expect(isSitemapPair(cpu({ tier: "ENTRY" }), gpu({ tier: "ENTHUSIAST" }))).toBe(false);
  });

  it("excludes pairs missing a score even when tiers match", () => {
    expect(isSitemapPair(cpu({ singleCoreScore: null }), gpu({ tier: "MID" }))).toBe(false);
  });

  it("excludes pairs without review figures even when tiers match", () => {
    expect(isSitemapPair(cpu(), gpu({ modelName: "Unreviewed GPU" }))).toBe(false);
  });
});

describe("hasReviewFigures", () => {
  it("needs a review figure on both sides", () => {
    expect(hasReviewFigures(cpu(), gpu())).toBe(true);
    expect(hasReviewFigures(cpu({ modelName: "Unreviewed CPU" }), gpu())).toBe(false);
    expect(hasReviewFigures(cpu(), gpu({ modelName: "Unreviewed GPU" }))).toBe(false);
  });

  it("counts a figure reached through an alias", () => {
    expect(hasReviewFigures(cpu(), gpu({ modelName: "NVIDIA GeForce RTX 5090 D" }))).toBe(true);
  });
});

describe("sitemapPairs", () => {
  it("returns only qualifying combinations", () => {
    const cpus = [cpu({ id: "c-mid", tier: "MID" }), cpu({ id: "c-entry", tier: "ENTRY" })];
    const gpus = [gpu({ id: "g-high", tier: "HIGH" }), gpu({ id: "g-entry", tier: "ENTRY" })];
    const ids = sitemapPairs(cpus, gpus).map((p) => `${p.cpu.id}+${p.gpu.id}`);
    expect(ids).toEqual(["c-mid+g-high", "c-mid+g-entry", "c-entry+g-entry"]);
  });

  it("is empty when there is no hardware", () => {
    expect(sitemapPairs([], [gpu()])).toEqual([]);
    expect(sitemapPairs([cpu()], [])).toEqual([]);
  });
});

describe("pairResults", () => {
  it("computes one result per resolution in display order", () => {
    expect(pairResults(cpu(), gpu()).map((r) => r.resolution)).toEqual(["1080p", "1440p", "4K"]);
  });
});

describe("bestResolution", () => {
  it("picks the lowest imbalance", () => {
    expect(bestResolution([row("1080p", "CPU", 30), row("1440p", "CPU", 5), row("4K", "GPU", 20)])).toBe(
      "1440p"
    );
  });

  it("prefers the higher resolution on a tie", () => {
    expect(bestResolution([row("1080p", "Balanced", 4), row("1440p", "Balanced", 4), row("4K", "GPU", 40)])).toBe(
      "1440p"
    );
  });
});

describe("worstBottleneck", () => {
  it("returns the largest non-balanced imbalance", () => {
    expect(worstBottleneck([row("1080p", "CPU", 30), row("1440p", "Balanced", 5), row("4K", "GPU", 45)])).toEqual({
      resolution: "4K",
      component: "GPU",
    });
    expect(worstBottleneck([row("1080p", "CPU", 50), row("4K", "GPU", 45)])).toEqual({
      resolution: "1080p",
      component: "CPU",
    });
  });

  it("returns null when every resolution is balanced", () => {
    expect(worstBottleneck([row("1080p", "Balanced", 2), row("1440p", "Balanced", 8)])).toBeNull();
  });
});

describe("pairVerdict", () => {
  it("says well matched when all resolutions are balanced", () => {
    expect(pairVerdict([row("1080p", "Balanced", 2), row("1440p", "Balanced", 3), row("4K", "Balanced", 9)])).toBe(
      "Well matched at every resolution: neither part holds the other back."
    );
  });

  it("names the balanced resolutions and each bottleneck", () => {
    expect(pairVerdict([row("1080p", "CPU", 23.4), row("1440p", "Balanced", 4), row("4K", "Balanced", 6)])).toBe(
      "Well matched at 1440p and 4K; the CPU holds the GPU back at 1080p (23% imbalance)."
    );
  });

  it("groups resolutions with the same bottleneck and capitalizes the first clause", () => {
    expect(pairVerdict([row("1080p", "CPU", 40), row("1440p", "CPU", 15), row("4K", "GPU", 31.6)])).toBe(
      "The CPU holds the GPU back at 1080p (40% imbalance) and 1440p (15%); the GPU is the limit at 4K (32% imbalance)."
    );
  });

  it("names a GPU limit when only the GPU bottlenecks", () => {
    expect(pairVerdict([row("1080p", "GPU", 12), row("1440p", "GPU", 37), row("4K", "GPU", 72)])).toBe(
      "The GPU is the limit at 1080p (12% imbalance), 1440p (37%) and 4K (72%)."
    );
  });
});

describe("relatedGpus / relatedCpus", () => {
  const base = cpu({ tier: "MID" });
  const current = gpu({ id: "g-current", tier: "MID", rasterScore: 10000 });
  const gpus = [
    current,
    gpu({ id: "g-near", tier: "MID", rasterScore: 11000 }),
    gpu({ id: "g-far", tier: "HIGH", rasterScore: 20000 }),
    gpu({ id: "g-mismatch", tier: "ENTHUSIAST", rasterScore: 10500 }),
    gpu({ id: "g-noscore", tier: "MID", rasterScore: null }),
  ];

  it("lists closest sitemap-eligible GPUs, excluding the current one", () => {
    expect(relatedGpus(base, current, gpus).map((g) => g.id)).toEqual(["g-near", "g-far"]);
    expect(relatedGpus(base, current, gpus, 1).map((g) => g.id)).toEqual(["g-near"]);
  });

  it("lists closest sitemap-eligible CPUs, excluding the current one", () => {
    const cpus = [
      base,
      cpu({ id: "c-near", tier: "MID", singleCoreScore: 3400 }),
      cpu({ id: "c-far", tier: "ENTRY", singleCoreScore: 2000 }),
      cpu({ id: "c-mismatch", tier: "ENTHUSIAST", singleCoreScore: 3350 }),
    ];
    expect(relatedCpus(base, current, cpus).map((c) => c.id)).toEqual(["c-near", "c-far"]);
  });

  it("returns nothing when no alternative qualifies", () => {
    expect(relatedGpus(base, current, [current])).toEqual([]);
  });
});

describe("pairSummary", () => {
  it("bundles results, best and worst resolution and the verdict", () => {
    const summary = pairSummary(cpu(), gpu());
    expect(summary.results).toHaveLength(3);
    expect(summary.best).toBe(bestResolution(summary.results));
    expect(summary.worst).toEqual(worstBottleneck(summary.results));
    expect(summary.verdict).toBe(pairVerdict(summary.results));
  });
});
