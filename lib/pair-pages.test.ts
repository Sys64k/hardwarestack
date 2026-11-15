import { describe, it, expect } from "vitest";
import {
  bestResolution,
  fixHeading,
  fixMessage,
  hasScores,
  hasReviewFigures,
  isSitemapPair,
  pairAnalysis,
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

  it("lists the CPUs closest in gaming performance, not single-core score", () => {
    // Gaming figures: 5800X3D 68.6, 9600X 72.6, 5600 53.7. By single-core score the 5600
    // would be nearest; its X3D cache makes the 5800X3D game like a 9600X.
    const x3d = cpu({ id: "c-5800x3d", modelName: "AMD Ryzen 7 5800X3D", singleCoreScore: 1700 });
    const cpus = [
      x3d,
      cpu({ id: "c-5600", modelName: "AMD Ryzen 5 5600", singleCoreScore: 1650 }),
      cpu({ id: "c-9600x", modelName: "AMD Ryzen 5 9600X", singleCoreScore: 2100 }),
      cpu({ id: "c-mismatch", modelName: "AMD Ryzen 5 9600X", tier: "ENTHUSIAST" }),
      cpu({ id: "c-unreviewed", modelName: "AMD Ryzen 5 5500" }),
    ];
    expect(relatedCpus(x3d, current, cpus).map((c) => c.id)).toEqual(["c-9600x", "c-5600"]);
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
  // Real names, so the review figures apply. Frame rates the model gets from them:
  // CPUs: 9800X3D ~204 fps, Ryzen 5 5600 ~113 fps.
  // GPUs (1080p / 1440p / 4K): RX 6600 52 / 25 / 15, RX 9070 XT 167 / 117 / 66,
  // RTX 4090 205 / 143 / 89, RTX 5090 239 / 167 / 111 (the China-only 5090 D the same).
  const x3d = cpu({ id: "x3d", modelName: "AMD Ryzen 7 9800X3D", socket: "AM5" });
  const r5600 = cpu({ id: "5600", modelName: "AMD Ryzen 5 5600", socket: "AM4" });
  const rx6600 = gpu({ id: "6600", modelName: "AMD Radeon RX 6600" });
  const rx9070xt = gpu({ id: "9070xt", modelName: "AMD Radeon RX 9070 XT" });
  const rtx4090 = gpu({ id: "4090", modelName: "NVIDIA GeForce RTX 4090" });
  const rtx5090 = gpu({ id: "5090", modelName: "NVIDIA GeForce RTX 5090" });
  const rtx5090d = gpu({ id: "5090d", modelName: "NVIDIA GeForce RTX 5090 D" });

  it("gives each limited resolution the smallest fix, merging resolutions that share one", () => {
    const fixes = pairFixes(r5600, rx6600, [r5600], [rx6600, rx9070xt, rtx5090, rtx5090d]);
    expect(fixes.map((f) => [f.resolutions, f.component, f.resolves, f.closest])).toEqual([
      [["1080p", "1440p"], "GPU", true, rx9070xt.modelName],
      [["4K"], "GPU", true, rtx5090.modelName],
    ]);
    expect(fixHeading(fixes[0])).toBe("1080p and 1440p: the GPU is the limit");
  });

  it("says when no part removes the bottleneck, naming the closest", () => {
    const fixes = pairFixes(x3d, rx6600, [x3d], [rx6600, rx9070xt, rtx5090]);
    expect(fixes.map((f) => [f.resolutions, f.resolves, f.closest])).toEqual([
      [["1080p"], true, rtx5090.modelName],
      [["1440p", "4K"], false, rtx5090.modelName],
    ]);
  });

  it("has no plan when no faster part exists", () => {
    const fixes = pairFixes(x3d, rtx5090, [x3d], [rtx5090]);
    expect(fixes).toEqual([
      { resolutions: ["1080p"], component: "CPU", plan: null, resolves: false, closest: null },
      { resolutions: ["1440p", "4K"], component: "GPU", plan: null, resolves: false, closest: null },
    ]);
    expect(fixMessage(fixes[0], x3d, rtx5090)).toBe(
      "The AMD Ryzen 7 9800X3D is already the fastest gaming CPU in our list, so no upgrade removes it. The graphics card has power to spare: a higher resolution puts it to use."
    );
  });

  it("skips balanced resolutions", () => {
    const fixes = pairFixes(x3d, rtx4090, [x3d], [rtx4090]);
    expect(fixes.some((f) => f.resolutions.includes("1080p"))).toBe(false);
    expect(pairFixes(x3d, rx6600, [x3d], [rx6600], [row("1080p", "Balanced", 2)])).toEqual([]);
  });

  it("introduces a fix, or names the closest part when none removes the bottleneck", () => {
    const [fix1080, fixHigh] = pairFixes(x3d, rx6600, [x3d], [rx6600, rx9070xt, rtx5090]);
    expect(fixMessage(fix1080, x3d, rx6600)).toBe("The smallest graphics card upgrade that removes it:");
    expect(fixMessage(fixHigh, x3d, rx6600)).toBe(
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

describe("pairAnalysis", () => {
  const x3d = cpu({ modelName: "AMD Ryzen 7 9800X3D" });
  const card = gpu({ modelName: "AMD Radeon RX 9070 XT" });
  const cpuRow = (resolution: Resolution, pct: number, gpuUtilization: number): ResolutionResult => ({
    resolution,
    result: { cpuUtilization: 100, gpuUtilization, ramUtilization: 80, bottleneckComponent: "CPU", bottleneckPercentage: pct },
  });
  const gpuRow = (resolution: Resolution, pct: number, cpuUtilization: number): ResolutionResult => ({
    resolution,
    result: { cpuUtilization, gpuUtilization: 100, ramUtilization: 80, bottleneckComponent: "GPU", bottleneckPercentage: pct },
  });

  it("states each part's standing, the best resolution and what goes unused", () => {
    const results = [cpuRow("1080p", 20, 80), row("1440p", "Balanced", 4), gpuRow("4K", 55, 45)];
    expect(pairAnalysis(x3d, card, results)).toEqual([
      "Among CPUs, the AMD Ryzen 7 9800X3D games at 97% of the speed of the fastest in our list. Among graphics cards, the AMD Radeon RX 9070 XT reaches 70% of the fastest.",
      "1440p suits this pair best: the two are within 4% of each other there, so neither waits on the other.",
      "At 1080p, about 20% of the AMD Radeon RX 9070 XT's power goes unused, because the CPU can't prepare frames fast enough.",
      "At 4K, the graphics card sets the frame rate, and about 55% of the AMD Ryzen 7 9800X3D's power goes unused.",
    ]);
  });

  it("names the limit at the best resolution when none is balanced, and uses the worst row per part", () => {
    const results = [gpuRow("1080p", 15, 85), gpuRow("1440p", 40, 60), gpuRow("4K", 70, 30)];
    const [, best, unused] = pairAnalysis(x3d, card, results);
    expect(best).toBe(
      "1080p is the closest match for this pair, though the GPU is still the limit there: the graphics card sets the frame rate, and about 15% of the AMD Ryzen 7 9800X3D's power goes unused."
    );
    expect(unused).toBe("At 4K, the graphics card sets the frame rate, and about 70% of the AMD Ryzen 7 9800X3D's power goes unused.");
    expect(pairAnalysis(x3d, card, results)).toHaveLength(3);
  });

  it("doesn't repeat the best resolution when it is also the worst for its part", () => {
    const results = [cpuRow("1080p", 22, 78), gpuRow("1440p", 30, 70), gpuRow("4K", 68, 32)];
    const sentences = pairAnalysis(x3d, card, results);
    expect(sentences.filter((s) => s.includes("1080p"))).toHaveLength(1);
    expect(sentences).toHaveLength(3);
  });

  it("marks an estimated figure", () => {
    const unreviewed = cpu({ modelName: "Unreviewed CPU", singleCoreScore: 3300 });
    expect(pairAnalysis(unreviewed, card, [row("1080p", "Balanced", 2)])[0]).toMatch(/% \(estimated\) of the speed/);
  });
});
