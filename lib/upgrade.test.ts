import { describe, it, expect } from "vitest";
import {
  cpuGamingOrderScore,
  describeCpuOption,
  describePlan,
  upgradeHeadline,
  planCpuUpgrade,
  planGpuUpgrade,
  planRamUpgrade,
  planUpgrade,
} from "./upgrade";
import type { CpuUpgradeOption } from "./upgrade";
import { SOCKET_GENERATIONS, SOCKET_ORDER, SOCKET_RAM_COMPAT, isOlderPlatform, isRamCompatible, ramTypesForSocket } from "./platform";
import type { CpuOption, GpuOption, RamOption } from "@/types/hardware";

const cpu = (id: string, o: Partial<CpuOption> = {}): CpuOption => ({
  id,
  vendor: "AMD",
  modelName: id,
  tier: "MID",
  socket: "AM4",
  cores: 6,
  threads: 12,
  boostClockGhz: 4.6,
  singleCoreScore: 1500,
  retailLinks: [],
  ...o,
});
const gpu = (id: string, rasterScore: number | null): GpuOption => ({
  id,
  vendor: "NVIDIA",
  modelName: id,
  tier: "MID",
  vramGb: 8,
  memoryBandwidthGbs: 300,
  rasterScore,
  retailLinks: [],
});
const ram = (id: string, type: "DDR4" | "DDR5", speedMhz: number, channels = 2): RamOption => ({
  id,
  modelName: id,
  type,
  speedMhz,
  capacityGb: 32,
  channels,
  latencyCl: null,
  tier: "MID",
  retailLinks: [],
});

const current = cpu("5600x");
const am4Fast = cpu("5800x3d", { tier: "HIGH", singleCoreScore: 1800 });
const am4Mid = cpu("5700x", { singleCoreScore: 1600 });
const am5 = cpu("7700x", { tier: "HIGH", socket: "AM5", singleCoreScore: 2000 });
const am5Top = cpu("7950x", { tier: "ENTHUSIAST", socket: "AM5", singleCoreScore: 2100 });
const intel = cpu("13600k", { vendor: "INTEL", socket: "LGA1700", tier: "HIGH", singleCoreScore: 1950 });
const slower = cpu("3600", { tier: "ENTRY", singleCoreScore: 1300 });
const ALL = [current, am4Fast, am4Mid, am5, am5Top, intel, slower];
const ddr4 = ram("ddr4-3200", "DDR4", 3200);

describe("cpuGamingOrderScore", () => {
  it("caps cores at 8 and adds the X3D cache bonus", () => {
    const eight = cpu("Ryzen 7 5800X", { cores: 8, singleCoreScore: 1700 });
    const sixteen = cpu("Ryzen 9 5950X", { cores: 16, singleCoreScore: 1700 });
    const x3d = cpu("Ryzen 7 5800X3D", { cores: 8, singleCoreScore: 1700 });
    expect(cpuGamingOrderScore(sixteen)).toBe(cpuGamingOrderScore(eight));
    expect(cpuGamingOrderScore(x3d)).toBeCloseTo(cpuGamingOrderScore(eight) * 1.2);
  });

  it("scores a CPU without a single-core score as 0", () => {
    expect(cpuGamingOrderScore(cpu("x", { singleCoreScore: null }))).toBe(0);
  });
});

describe("ramTypesForSocket", () => {
  it("maps known sockets and returns null for missing or unknown ones", () => {
    expect(ramTypesForSocket("AM5")).toEqual(["DDR5"]);
    expect(ramTypesForSocket("LGA1700")).toEqual(["DDR4", "DDR5"]);
    expect(ramTypesForSocket(null)).toBeNull();
    expect(ramTypesForSocket("TR5")).toBeNull();
  });
});

describe("isRamCompatible", () => {
  it("checks the socket's RAM types and treats unknown sockets as compatible", () => {
    expect(isRamCompatible("AM4", "DDR4")).toBe(true);
    expect(isRamCompatible("AM4", "DDR5")).toBe(false);
    expect(isRamCompatible(null, "DDR5")).toBe(true);
    expect(isRamCompatible("TR5", "DDR4")).toBe(true);
  });
});

describe("socket tables", () => {
  it("list every socket in the RAM table, the order and a generation line", () => {
    const generations = SOCKET_GENERATIONS.flat();
    expect(Object.keys(SOCKET_RAM_COMPAT).sort()).toEqual([...SOCKET_ORDER].sort());
    expect([...generations].sort()).toEqual([...SOCKET_ORDER].sort());
  });
});

describe("isOlderPlatform", () => {
  it("compares generations within a vendor only", () => {
    expect(isOlderPlatform("AM5", "AM4")).toBe(true);
    expect(isOlderPlatform("AM4", "AM5")).toBe(false);
    expect(isOlderPlatform("LGA1851", "LGA1700")).toBe(true);
    expect(isOlderPlatform("LGA1200", "LGA1851")).toBe(false);
    expect(isOlderPlatform("AM5", "LGA1700")).toBe(false);
    expect(isOlderPlatform("AM5", "TR5")).toBe(false);
  });
});

describe("planCpuUpgrade", () => {
  it("suggests only the drop-in when a same-socket CPU removes the bottleneck", () => {
    const plan = planCpuUpgrade(current, ALL, ddr4, (c) => c.id === am4Mid.id || c.id === am4Fast.id);
    expect(plan).toEqual({
      kind: "CPU",
      currentSocket: "AM4",
      options: [{ cpu: am4Mid, resolves: true, platform: null }],
    });
  });

  it("adds a platform upgrade, from any vendor, when no drop-in removes the bottleneck", () => {
    const plan = planCpuUpgrade(current, ALL, ddr4, (c) => c.socket !== "AM4");
    expect(plan?.kind).toBe("CPU");
    if (plan?.kind !== "CPU") return;
    expect(plan.options).toHaveLength(3);
    expect(plan.options[0]).toEqual({ cpu: am4Fast, resolves: false, platform: null });
    // Lowest-ranked fix across vendors is the 13600K (HIGH, 1950, below the 7700X's 2000),
    // so the best AMD platform upgrade is offered first.
    expect(plan.options[1]).toEqual({
      cpu: am5,
      resolves: true,
      platform: { socket: "AM5", ramTypes: ["DDR5"], needsNewRam: true },
    });
    expect(plan.options[2]).toEqual({
      cpu: intel,
      resolves: true,
      platform: { socket: "LGA1700", ramTypes: ["DDR4", "DDR5"], needsNewRam: false },
    });
  });

  it("flags new RAM when the new socket doesn't take the current type", () => {
    const plan = planCpuUpgrade(current, [current, am5], ddr4, () => true);
    if (plan?.kind !== "CPU") throw new Error("expected a CPU plan");
    expect(plan.options).toEqual([
      { cpu: am5, resolves: true, platform: { socket: "AM5", ramTypes: ["DDR5"], needsNewRam: true } },
    ]);
  });

  it("leaves needsNewRam unknown when no RAM is selected", () => {
    const plan = planCpuUpgrade(current, [current, am5], undefined, () => true);
    if (plan?.kind !== "CPU") throw new Error("expected a CPU plan");
    expect(plan.options[0].platform?.needsNewRam).toBeNull();
  });

  it("falls back to the strongest options when nothing removes the bottleneck", () => {
    const plan = planCpuUpgrade(current, ALL, ddr4, () => false);
    if (plan?.kind !== "CPU") throw new Error("expected a CPU plan");
    // The strongest new-socket CPU is the 7950X, same vendor, so no extra option.
    expect(plan.options.map((o) => [o.cpu.id, o.resolves])).toEqual([
      ["5800x3d", false],
      ["7950x", false],
    ]);
  });

  it("skips the same-vendor option when the vendor has nothing on a new socket", () => {
    const intelOnly = planCpuUpgrade(current, [current, intel], ddr4, () => true);
    if (intelOnly?.kind !== "CPU") throw new Error("expected a CPU plan");
    expect(intelOnly.options.map((o) => o.cpu.id)).toEqual(["13600k"]);
  });

  it("works the same way for Intel owners", () => {
    const i5 = cpu("12400", { vendor: "INTEL", socket: "LGA1700", tier: "MID", singleCoreScore: 1700 });
    const plan = planCpuUpgrade(i5, [i5, am5, intel], ddr4, (c) => c.socket === "AM5");
    if (plan?.kind !== "CPU") throw new Error("expected a CPU plan");
    // The 13600K is a drop-in that doesn't fix it; AM5 does, and Intel has no new-socket CPU here.
    expect(plan.options.map((o) => [o.cpu.id, o.resolves, o.platform?.socket ?? null])).toEqual([
      ["13600k", false, null],
      ["7700x", true, "AM5"],
    ]);
  });

  it("falls back to the best gaming CPU, not the highest tier label", () => {
    const r5950x = cpu("Ryzen 9 5950X", { tier: "ENTHUSIAST", cores: 16, singleCoreScore: 1700 });
    const r5800x3d = cpu("Ryzen 7 5800X3D", { tier: "HIGH", cores: 8, singleCoreScore: 1700 });
    const r3900x = cpu("Ryzen 9 3900X", { tier: "ULTRA", cores: 12, singleCoreScore: 1530 });
    const plan = planCpuUpgrade(current, [current, r5950x, r5800x3d, r3900x], ddr4, () => false);
    if (plan?.kind !== "CPU") throw new Error("expected a CPU plan");
    expect(plan.options[0]).toEqual({ cpu: r5800x3d, resolves: false, platform: null });
  });

  it("still prefers the lowest-ranked CPU that removes the bottleneck", () => {
    const r5950x = cpu("Ryzen 9 5950X", { tier: "ENTHUSIAST", cores: 16, singleCoreScore: 1700 });
    const r5800x3d = cpu("Ryzen 7 5800X3D", { tier: "HIGH", cores: 8, singleCoreScore: 1700 });
    const plan = planCpuUpgrade(current, [current, r5950x, r5800x3d], ddr4, () => true);
    if (plan?.kind !== "CPU") throw new Error("expected a CPU plan");
    expect(plan.options.map((o) => o.cpu.id)).toEqual(["Ryzen 7 5800X3D"]);
  });

  it("never suggests moving back to an older socket from the same vendor", () => {
    const r7600 = cpu("Ryzen 5 7600", { socket: "AM5", tier: "ENTRY", singleCoreScore: 1500 });
    const plan = planCpuUpgrade(r7600, [r7600, am4Fast, am5Top, intel], ddr4, (c) => c.socket === "LGA1700");
    if (plan?.kind !== "CPU") throw new Error("expected a CPU plan");
    expect(plan.options.map((o) => [o.cpu.id, o.platform?.socket ?? null])).toEqual([
      ["7950x", null],
      ["13600k", "LGA1700"],
    ]);
  });

  it("goes straight to a platform upgrade when nothing faster shares the socket", () => {
    const plan = planCpuUpgrade(am4Fast, [am4Fast, am5], ddr4, () => true);
    if (plan?.kind !== "CPU") throw new Error("expected a CPU plan");
    expect(plan.options.map((o) => o.cpu.id)).toEqual(["7700x"]);
  });

  it("keeps the old same-vendor behaviour when the current socket is unknown", () => {
    const unknown = cpu("mystery", { socket: null });
    const plan = planCpuUpgrade(unknown, ALL, ddr4, () => true);
    expect(plan).toEqual({
      kind: "CPU",
      currentSocket: null,
      options: [{ cpu: am4Mid, resolves: true, platform: null }],
    });
  });

  it("skips candidates without a socket for platform upgrades", () => {
    const noSocket = cpu("nosocket", { tier: "ULTRA", socket: null, singleCoreScore: 2200 });
    const plan = planCpuUpgrade(am4Fast, [am4Fast, noSocket], ddr4, () => true);
    expect(plan).toBeNull();
  });

  it("returns null when there is nothing faster", () => {
    expect(planCpuUpgrade(am5Top, ALL, ddr4, () => true)).toBeNull();
  });
});

describe("planGpuUpgrade", () => {
  const gpus = [gpu("a", 5000), gpu("b", 8000), gpu("c", 12000), gpu("none", null)];

  it("picks the weakest GPU that removes the bottleneck", () => {
    expect(planGpuUpgrade(gpus[0], gpus, (g) => (g.rasterScore ?? 0) >= 8000)).toEqual({
      kind: "GPU",
      gpu: gpus[1],
      resolves: true,
    });
  });

  it("falls back to the strongest GPU", () => {
    expect(planGpuUpgrade(gpus[0], gpus, () => false)).toEqual({ kind: "GPU", gpu: gpus[2], resolves: false });
  });

  it("returns null for the strongest GPU", () => {
    expect(planGpuUpgrade(gpus[2], gpus, () => true)).toBeNull();
  });
});

describe("planRamUpgrade", () => {
  const ddr4Fast = ram("ddr4-3600", "DDR4", 3600);
  const ddr5 = ram("ddr5-6000", "DDR5", 6000);
  const single = ram("ddr4-3200-sc", "DDR4", 3200, 1);

  it("only suggests kits the motherboard can take", () => {
    expect(planRamUpgrade(current, single, [single, ddr4, ddr4Fast, ddr5], () => false)).toEqual({
      kind: "RAM",
      ram: ddr4Fast,
      resolves: false,
    });
  });

  it("picks the slowest kit that removes the bottleneck", () => {
    expect(planRamUpgrade(current, single, [single, ddr4Fast, ddr4], () => true)?.kind).toBe("RAM");
    expect(planRamUpgrade(current, single, [single, ddr4Fast, ddr4], () => true)).toEqual({
      kind: "RAM",
      ram: ddr4,
      resolves: true,
    });
  });

  it("considers every type when the socket is unknown", () => {
    const plan = planRamUpgrade(cpu("x", { socket: null }), ddr4, [ddr4, ddr5], () => true);
    expect(plan).toEqual({ kind: "RAM", ram: ddr5, resolves: true });
  });

  it("returns null when no compatible kit is faster", () => {
    expect(planRamUpgrade(current, ddr4Fast, [ddr4Fast, ddr5], () => true)).toBeNull();
  });
});

describe("planUpgrade", () => {
  it("returns null for a RAM bottleneck without selected RAM", () => {
    expect(
      planUpgrade({ target: "RAM", cpu: current, gpu: gpu("g", 8000), ram: undefined, cpus: ALL, gpus: [], rams: [ddr4], resolution: "1080p" }),
    ).toBeNull();
  });

  it("wires the CPU plan to the bottleneck calculation", () => {
    const plan = planUpgrade({
      target: "CPU",
      cpu: slower,
      gpu: gpu("g", 6000),
      ram: ddr4,
      cpus: ALL,
      gpus: [],
      rams: [],
      resolution: "1080p",
    });
    expect(plan?.kind).toBe("CPU");
  });
});

describe("describeCpuOption", () => {
  const opt = (o: Partial<CpuUpgradeOption>): CpuUpgradeOption => ({ cpu: am5, resolves: true, platform: null, ...o });

  it("says a drop-in fits the current board", () => {
    expect(describeCpuOption(opt({}), "AM4")).toBe("Fits your current AM4 motherboard.");
  });

  it("notes a partial fix", () => {
    expect(describeCpuOption(opt({ resolves: false }), "AM4")).toBe(
      "Fits your current AM4 motherboard. Reduces the bottleneck but doesn't remove it.",
    );
  });

  it("asks to check compatibility when the current socket is unknown", () => {
    expect(describeCpuOption(opt({}), null)).toBe("Check that it fits your motherboard.");
  });

  it("names the new board and RAM", () => {
    const platform = { socket: "AM5", ramTypes: ["DDR5" as const], needsNewRam: true };
    expect(describeCpuOption(opt({ platform }), "AM4")).toBe("Needs a new AM5 motherboard and DDR5 RAM.");
  });

  it("says the RAM can stay on a board that takes it", () => {
    const platform = { socket: "LGA1700", ramTypes: ["DDR4" as const, "DDR5" as const], needsNewRam: false };
    expect(describeCpuOption(opt({ platform }), "AM4", "DDR4")).toBe(
      "Needs a new LGA1700 motherboard; pick a DDR4 board to keep your RAM.",
    );
    const single = { socket: "AM5", ramTypes: ["DDR5" as const], needsNewRam: false };
    expect(describeCpuOption(opt({ platform: single }), "LGA1851")).toBe(
      "Needs a new AM5 motherboard; your RAM still fits.",
    );
  });

  it("lists RAM types when no RAM is selected, and handles unknown sockets", () => {
    const known = { socket: "AM5", ramTypes: ["DDR5" as const], needsNewRam: null };
    expect(describeCpuOption(opt({ platform: known }), "AM4")).toBe("Needs a new AM5 motherboard (DDR5 RAM).");
    const unknown = { socket: "TR5", ramTypes: null, needsNewRam: null };
    expect(describeCpuOption(opt({ platform: unknown }), "AM4")).toBe(
      "Needs a new TR5 motherboard; check which RAM it takes.",
    );
  });
});

describe("describePlan", () => {
  it("labels each row, naming vendors when both offer a platform upgrade", () => {
    const plan = planCpuUpgrade(current, ALL, ddr4, (c) => c.socket !== "AM4")!;
    expect(describePlan(plan, current, ddr4)).toEqual([
      {
        modelName: "5800x3d",
        label: "Drop-in",
        note: "Fits your current AM4 motherboard. Reduces the bottleneck but doesn't remove it.",
      },
      {
        modelName: "7700x",
        label: "Platform upgrade · AMD",
        note: "Needs a new AM5 motherboard and DDR5 RAM.",
      },
      {
        modelName: "13600k",
        label: "Platform upgrade · Intel",
        note: "Needs a new LGA1700 motherboard; pick a DDR4 board to keep your RAM.",
      },
    ]);
  });

  it("leaves out the vendor when only one platform upgrade is shown", () => {
    const plan = planCpuUpgrade(current, [current, am4Fast, am5], ddr4, (c) => c.socket === "AM5")!;
    expect(describePlan(plan, current, ddr4).map((s) => s.label)).toEqual(["Drop-in", "Platform upgrade"]);
  });

  it("omits the label for a single CPU option", () => {
    const plan = planCpuUpgrade(current, [current, am5], ddr4, () => true)!;
    expect(describePlan(plan, current, ddr4)).toEqual([
      { modelName: "7700x", label: null, note: "Needs a new AM5 motherboard and DDR5 RAM." },
    ]);
  });

  it("notes RAM fit only when the socket is known", () => {
    const ddr4Fast = ram("ddr4-3600", "DDR4", 3600);
    const plan = { kind: "RAM" as const, ram: ddr4Fast, resolves: true };
    expect(describePlan(plan, current, ddr4)[0].note).toBe("Fits your AM4 motherboard.");
    expect(describePlan(plan, cpu("x", { socket: null }), ddr4)[0].note).toBeNull();
  });

  it("has no note for GPUs", () => {
    const plan = { kind: "GPU" as const, gpu: gpu("g", 9000), resolves: true };
    expect(describePlan(plan, current, undefined)).toEqual([{ modelName: "g", label: null, note: null }]);
  });
});

describe("upgradeHeadline", () => {
  const gpuPlan = { kind: "GPU" as const, gpu: gpu("g", 9000), resolves: true };

  it("warns that 4K may not be fully fixable", () => {
    expect(upgradeHeadline(gpuPlan, "4K")).toMatch(/^4K is extremely GPU-demanding/);
    expect(upgradeHeadline(gpuPlan, "1440p")).toMatch(/^Your graphics card/);
  });

  it("explains CPU and RAM bottlenecks", () => {
    expect(upgradeHeadline({ kind: "CPU", currentSocket: "AM4", options: [] }, "1080p")).toMatch(/^Your processor/);
    expect(upgradeHeadline({ kind: "RAM", ram: ddr4, resolves: true }, "1080p")).toMatch(/^Slow or single-channel/);
  });
});
