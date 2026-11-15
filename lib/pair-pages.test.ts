import { describe, it, expect } from "vitest";
import {
  bestResolution,
  fixHeading,
  fixMessage,
  hasScores,
  hasReviewFigures,
  isSitemapPair,
  pairFixes,
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
  it("bundles results, best resolution and the verdict", () => {
    const summary = pairSummary(cpu(), gpu());
    expect(summary.results).toHaveLength(3);
    expect(summary.best).toBe(bestResolution(summary.results));
    expect(summary.verdict).toBe(pairVerdict(summary.results));
  });
});

describe("pairFixes / fixHeading / fixMessage", () => {
  // Real names, so the measured gaming figures apply: 9800X3D = 100, RX 6600 = 14.9,
  // RX 9070 XT = 69.7, RTX 5090 (and the China-only 5090 D) = 100.
  const x3d = cpu({ id: "x3d", modelName: "AMD Ryzen 7 9800X3D", socket: "AM5" });
  const rx6600 = gpu({ id: "6600", modelName: "AMD Radeon RX 6600" });
  const rx9070xt = gpu({ id: "9070xt", modelName: "AMD Radeon RX 9070 XT" });
  const rtx5090 = gpu({ id: "5090", modelName: "NVIDIA GeForce RTX 5090" });
  const rtx5090d = gpu({ id: "5090d", modelName: "NVIDIA GeForce RTX 5090 D" });

  it("gives each limited resolution the smallest fix, and says when none removes it", () => {
    const fixes = pairFixes(x3d, rx6600, [x3d], [rx6600, rx9070xt, rtx5090, rtx5090d]);
    expect(fixes.map((f) => [f.resolutions, f.component, f.resolves])).toEqual([
      [["1080p"], "GPU", true],
      [["1440p"], "GPU", true],
      [["4K"], "GPU", false],
    ]);
    expect(fixes.map((f) => (f.plan?.kind === "GPU" ? f.plan.gpu.id : null))).toEqual(["9070xt", "5090", "5090"]);
    expect(fixes.map((f) => f.closest)).toEqual([rx9070xt.modelName, rtx5090.modelName, rtx5090.modelName]);
  });

  it("merges resolutions with the same limit and the same suggested part", () => {
    const fixes = pairFixes(x3d, rx6600, [x3d], [rx6600, rtx5090]);
    expect(fixes.map((f) => f.resolutions)).toEqual([["1080p", "1440p"], ["4K"]]);
    expect(fixHeading(fixes[0])).toBe("1080p and 1440p: the GPU is the limit");
  });

  it("skips balanced resolutions and has no plan when no faster part exists", () => {
    const fixes = pairFixes(x3d, rtx5090, [x3d], [rtx5090]);
    expect(fixes[0]).toEqual({ resolutions: ["1080p"], component: "CPU", plan: null, resolves: false, closest: null });
    expect(fixes.some((f) => f.resolutions.includes("1440p"))).toBe(false);
    expect(fixMessage(fixes[0], x3d, rtx5090)).toBe(
      "The AMD Ryzen 7 9800X3D is already the fastest gaming CPU in our list, so no upgrade removes it. The graphics card has power to spare: a higher resolution puts it to use."
    );
  });

  it("returns nothing for a pair that is balanced everywhere", () => {
    expect(pairFixes(x3d, rx6600, [x3d], [rx6600], [row("1080p", "Balanced", 2)])).toEqual([]);
  });

  it("introduces a fix, or names the closest part when none removes the bottleneck", () => {
    const [fix1080, , fix4k] = pairFixes(x3d, rx6600, [x3d], [rx6600, rx9070xt, rtx5090]);
    expect(fixMessage(fix1080, x3d, rx6600)).toBe("The smallest graphics card upgrade that removes it:");
    expect(fixMessage(fix4k, x3d, rx6600)).toBe(
      "No graphics card in our list removes it; even the NVIDIA GeForce RTX 5090 only narrows the gap. At 4K that's normal: upscaling (DLSS, FSR or XeSS) or lower settings are the usual fix."
    );
  });

  it("adds the 4K note only to a GPU limit at 4K", () => {
    const fix = { resolutions: ["1080p" as const], component: "CPU" as const, resolves: false, closest: "AMD Ryzen 7 9800X3D" };
    const plan = { kind: "CPU" as const, currentSocket: "AM5", options: [{ cpu: x3d, resolves: false, platform: null }] };
    expect(fixMessage({ ...fix, plan }, x3d, rtx5090)).toBe(
      "No CPU in our list removes it; even the AMD Ryzen 7 9800X3D only narrows the gap. The graphics card has power to spare: a higher resolution puts it to use."
    );
  });

  it("says when only a new platform removes a CPU limit", () => {
    const am5 = cpu({ id: "am5", socket: "AM5" });
    const plan = {
      kind: "CPU" as const,
      currentSocket: "AM4",
      options: [
        { cpu: x3d, resolves: false, platform: null },
        { cpu: am5, resolves: true, platform: { socket: "AM5", ramTypes: ["DDR5" as const], needsNewRam: null } },
      ],
    };
    const fix = { resolutions: ["1080p" as const], component: "CPU" as const, plan, resolves: true, closest: "am5" };
    expect(fixMessage(fix, x3d, rtx5090)).toBe("No CPU that fits the current motherboard removes it; a new platform does:");
    expect(fixMessage({ ...fix, plan: { ...plan, options: [plan.options[1]] } }, x3d, rtx5090)).toBe(
      "The smallest CPU upgrade that removes it:"
    );
  });

  it("notes the CPU's spare power when the fastest GPU is the limit", () => {
    const fix = { resolutions: ["1440p" as const], component: "GPU" as const, plan: null, resolves: false, closest: null };
    expect(fixMessage(fix, x3d, rtx5090)).toBe(
      "The NVIDIA GeForce RTX 5090 is already the fastest gaming graphics card in our list, so no upgrade removes it. The CPU has power to spare here."
    );
  });
});
