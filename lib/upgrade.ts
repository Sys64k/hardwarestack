import { calculateBottleneck } from "./bottleneck";
import { isRamCompatible, ramTypesForSocket } from "./platform";
import type {
  BottleneckComponent,
  CpuOption,
  GpuOption,
  RamOption,
  RamTypeValue,
  Resolution,
} from "@/types/hardware";

export type UpgradeTarget = Exclude<BottleneckComponent, "Balanced">;

const TIER_RANK: Record<string, number> = { ENTRY: 0, MID: 1, HIGH: 2, ULTRA: 3, ENTHUSIAST: 4 };

// What else has to change when the new CPU needs a different socket.
export interface PlatformChange {
  socket: string;
  ramTypes: RamTypeValue[] | null; // null when the new socket's RAM support isn't known
  needsNewRam: boolean | null;     // null when no RAM is selected or support isn't known
}

export interface CpuUpgradeOption {
  cpu: CpuOption;
  resolves: boolean;                 // removes the CPU bottleneck at this resolution
  platform: PlatformChange | null;   // null: fits the current socket (or the socket is unknown)
}

export type UpgradePlan =
  | { kind: "CPU"; currentSocket: string | null; options: CpuUpgradeOption[] }
  | { kind: "GPU"; gpu: GpuOption; resolves: boolean }
  | { kind: "RAM"; ram: RamOption; resolves: boolean };

function cpuRank(c: CpuOption): [number, number] {
  return [TIER_RANK[c.tier] ?? 0, c.singleCoreScore ?? 0];
}

function isFasterCpu(candidate: CpuOption, current: CpuOption): boolean {
  const [ct, cs] = cpuRank(candidate);
  const [t, s] = cpuRank(current);
  return candidate.id !== current.id && (ct > t || (ct === t && cs > s));
}

function byCpuRank(a: CpuOption, b: CpuOption): number {
  const [at, as] = cpuRank(a);
  const [bt, bs] = cpuRank(b);
  return at - bt || as - bs;
}

// Lowest-ranked candidate that removes the bottleneck, else the strongest one.
function pick<T>(sorted: T[], resolves: (c: T) => boolean): { item: T; resolves: boolean } | null {
  const fix = sorted.find(resolves);
  if (fix) return { item: fix, resolves: true };
  const strongest = sorted[sorted.length - 1];
  return strongest ? { item: strongest, resolves: false } : null;
}

function platformChange(socket: string, ram: RamOption | undefined): PlatformChange {
  const ramTypes = ramTypesForSocket(socket);
  const needsNewRam = ram && ramTypes ? !ramTypes.includes(ram.type) : null;
  return { socket, ramTypes, needsNewRam };
}

// Same-socket drop-in first. A platform change is only suggested when no drop-in removes
// the bottleneck, and then from any vendor, since a new motherboard is needed either way.
export function planCpuUpgrade(
  cpu: CpuOption,
  cpus: CpuOption[],
  ram: RamOption | undefined,
  resolves: (candidate: CpuOption) => boolean,
): UpgradePlan | null {
  const faster = cpus.filter((c) => isFasterCpu(c, cpu)).sort(byCpuRank);

  if (!cpu.socket) {
    const picked = pick(faster.filter((c) => c.vendor === cpu.vendor), resolves);
    return picked
      ? { kind: "CPU", currentSocket: null, options: [{ cpu: picked.item, resolves: picked.resolves, platform: null }] }
      : null;
  }

  const options: CpuUpgradeOption[] = [];
  const dropIn = pick(faster.filter((c) => c.socket === cpu.socket), resolves);
  if (dropIn) options.push({ cpu: dropIn.item, resolves: dropIn.resolves, platform: null });

  if (!dropIn?.resolves) {
    const other = pick(faster.filter((c) => c.socket !== null && c.socket !== cpu.socket), resolves);
    if (other) options.push({ cpu: other.item, resolves: other.resolves, platform: platformChange(other.item.socket!, ram) });
  }

  return options.length > 0 ? { kind: "CPU", currentSocket: cpu.socket, options } : null;
}

export function planGpuUpgrade(
  gpu: GpuOption,
  gpus: GpuOption[],
  resolves: (candidate: GpuOption) => boolean,
): UpgradePlan | null {
  const current = gpu.rasterScore ?? 0;
  const faster = gpus
    .filter((g) => g.id !== gpu.id && (g.rasterScore ?? 0) > current)
    .sort((a, b) => (a.rasterScore ?? 0) - (b.rasterScore ?? 0));
  const picked = pick(faster, resolves);
  return picked ? { kind: "GPU", gpu: picked.item, resolves: picked.resolves } : null;
}

// Only kits the current CPU's motherboard can take, when its socket is known.
export function planRamUpgrade(
  cpu: CpuOption,
  ram: RamOption,
  rams: RamOption[],
  resolves: (candidate: RamOption) => boolean,
): UpgradePlan | null {
  const bandwidth = (r: RamOption) => r.speedMhz * r.channels;
  const faster = rams
    .filter((r) => r.id !== ram.id && bandwidth(r) > bandwidth(ram) && isRamCompatible(cpu.socket, r.type))
    .sort((a, b) => bandwidth(a) - bandwidth(b));
  const picked = pick(faster, resolves);
  return picked ? { kind: "RAM", ram: picked.item, resolves: picked.resolves } : null;
}

export interface UpgradeInput {
  target: UpgradeTarget;
  cpu: CpuOption;
  gpu: GpuOption;
  ram: RamOption | undefined;
  cpus: CpuOption[];
  gpus: GpuOption[];
  rams: RamOption[];
  resolution: Resolution;
}

export function planUpgrade({ target, cpu, gpu, ram, cpus, gpus, rams, resolution }: UpgradeInput): UpgradePlan | null {
  if (target === "GPU") {
    return planGpuUpgrade(gpu, gpus, (g) => calculateBottleneck(cpu, g, resolution, ram).bottleneckComponent !== "GPU");
  }
  if (target === "CPU") {
    return planCpuUpgrade(cpu, cpus, ram, (c) => calculateBottleneck(c, gpu, resolution, ram).bottleneckComponent !== "CPU");
  }
  if (!ram) return null;
  return planRamUpgrade(cpu, ram, rams, (r) => calculateBottleneck(cpu, gpu, resolution, r).bottleneckComponent !== "RAM");
}

// One-line note under a CPU suggestion: what it fits, and what else has to change.
export function describeCpuOption(
  option: CpuUpgradeOption,
  currentSocket: string | null,
  currentRamType: RamTypeValue | null = null,
): string {
  const effect = option.resolves ? "" : " Reduces the bottleneck but doesn't remove it.";
  if (!currentSocket) return `Check that it fits your motherboard.${effect}`;
  if (!option.platform) return `Fits your current ${currentSocket} motherboard.${effect}`;

  const { socket, ramTypes, needsNewRam } = option.platform;
  const board = `Needs a new ${socket} motherboard`;
  if (needsNewRam === true) return `${board} and ${ramTypes!.join(" or ")} RAM.${effect}`;
  if (needsNewRam === false) {
    const keep =
      ramTypes!.length > 1 && currentRamType ? `; pick a ${currentRamType} board to keep your RAM` : "; your RAM still fits";
    return `${board}${keep}.${effect}`;
  }
  if (ramTypes) return `${board} (${ramTypes.join(" or ")} RAM).${effect}`;
  return `${board}; check which RAM it takes.${effect}`;
}

// One row of the upgrade card.
export interface UpgradeSuggestion {
  modelName: string;
  label: string | null; // "Drop-in" / "Platform upgrade", only when there are two to choose from
  note: string | null;
}

export function describeRamOption(cpu: CpuOption): string | null {
  return ramTypesForSocket(cpu.socket) ? `Fits your ${cpu.socket} motherboard.` : null;
}

export function describePlan(plan: UpgradePlan, cpu: CpuOption, ram: RamOption | undefined): UpgradeSuggestion[] {
  if (plan.kind === "GPU") return [{ modelName: plan.gpu.modelName, label: null, note: null }];
  if (plan.kind === "RAM") return [{ modelName: plan.ram.modelName, label: null, note: describeRamOption(cpu) }];
  const both = plan.options.length > 1;
  return plan.options.map((option) => ({
    modelName: option.cpu.modelName,
    label: both ? (option.platform ? "Platform upgrade" : "Drop-in") : null,
    note: describeCpuOption(option, plan.currentSocket, ram?.type ?? null),
  }));
}

export function upgradeHeadline(plan: UpgradePlan, resolution: Resolution): string {
  if (plan.kind === "GPU") {
    return resolution === "4K"
      ? "4K is extremely GPU-demanding. No single upgrade may fully close the gap — this is the strongest option in our database."
      : "Your graphics card can't keep up at this resolution. A GPU upgrade will directly improve frame rates.";
  }
  if (plan.kind === "RAM") {
    return "Slow or single-channel RAM is starving your CPU. Upgrading to faster dual-channel memory can deliver measurable FPS gains.";
  }
  return "Your processor is the limiting factor. A faster CPU will unlock your GPU's full potential.";
}
