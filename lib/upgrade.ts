import { calculateBottleneck } from "./bottleneck";
import { cpuGamingScore } from "./cpu-gaming-index";
import { isOlderPlatform, isRamCompatible, ramTypesForSocket } from "./platform";
import type {
  BottleneckComponent,
  CpuOption,
  GpuOption,
  RamOption,
  RamTypeValue,
  Resolution,
} from "@/types/hardware";

export type UpgradeTarget = Exclude<BottleneckComponent, "Balanced">;

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

// CPUs are ordered by gaming performance (measured where a review has it), the same
// score the bottleneck verdict uses.
function isFasterCpu(candidate: CpuOption, current: CpuOption): boolean {
  return candidate.id !== current.id && cpuGamingScore(candidate) > cpuGamingScore(current);
}

function byGamingScore(a: CpuOption, b: CpuOption): number {
  return cpuGamingScore(a) - cpuGamingScore(b);
}

// Weakest candidate that removes the bottleneck, else the strongest (last in sort order).
function pick<T>(sorted: T[], resolves: (c: T) => boolean): { item: T; resolves: boolean } | null {
  const fix = sorted.find(resolves);
  if (fix) return { item: fix, resolves: true };
  const best = sorted.at(-1);
  return best ? { item: best, resolves: false } : null;
}

function platformChange(socket: string, ram: RamOption | undefined): PlatformChange {
  const ramTypes = ramTypesForSocket(socket);
  const needsNewRam = ram && ramTypes ? !ramTypes.includes(ram.type) : null;
  return { socket, ramTypes, needsNewRam };
}

// Same-socket drop-in first. A platform change is only suggested when no drop-in removes
// the bottleneck, and then from any vendor, since a new motherboard is needed either way.
// If that pick is from the other vendor, the best same-vendor platform upgrade is offered
// too (listed first), since most people stay with their vendor.
export function planCpuUpgrade(
  cpu: CpuOption,
  cpus: CpuOption[],
  ram: RamOption | undefined,
  resolves: (candidate: CpuOption) => boolean,
): UpgradePlan | null {
  const faster = cpus.filter((c) => isFasterCpu(c, cpu)).sort(byGamingScore);
  const pickCpu = (list: CpuOption[]) => pick(list, resolves);

  if (!cpu.socket) {
    const picked = pickCpu(faster.filter((c) => c.vendor === cpu.vendor));
    return picked
      ? { kind: "CPU", currentSocket: null, options: [{ cpu: picked.item, resolves: picked.resolves, platform: null }] }
      : null;
  }

  const options: CpuUpgradeOption[] = [];
  const dropIn = pickCpu(faster.filter((c) => c.socket === cpu.socket));
  if (dropIn) options.push({ cpu: dropIn.item, resolves: dropIn.resolves, platform: null });

  if (!dropIn?.resolves) {
    const currentSocket = cpu.socket; // narrowed to string for the closure below
    // A new platform is only worth it if it beats the best drop-in.
    const floor = dropIn ? cpuGamingScore(dropIn.item) : -Infinity;
    const newSocket = faster.filter(
      (c) =>
        c.socket !== null &&
        c.socket !== currentSocket &&
        !isOlderPlatform(currentSocket, c.socket) &&
        cpuGamingScore(c) > floor,
    );
    const any = pickCpu(newSocket);
    const sameVendor =
      any && any.item.vendor !== cpu.vendor ? pickCpu(newSocket.filter((c) => c.vendor === cpu.vendor)) : null;
    for (const p of [sameVendor, any]) {
      if (p) options.push({ cpu: p.item, resolves: p.resolves, platform: platformChange(p.item.socket!, ram) });
    }
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

const VENDOR_NAMES: Record<CpuOption["vendor"], string> = { AMD: "AMD", INTEL: "Intel", NVIDIA: "NVIDIA" };

function cpuOptionLabel(option: CpuUpgradeOption, nameVendor: boolean): string {
  if (!option.platform) return "Drop-in";
  return nameVendor ? `Platform upgrade · ${VENDOR_NAMES[option.cpu.vendor]}` : "Platform upgrade";
}

export function describePlan(plan: UpgradePlan, cpu: CpuOption, ram: RamOption | undefined): UpgradeSuggestion[] {
  if (plan.kind === "GPU") return [{ modelName: plan.gpu.modelName, label: null, note: null }];
  if (plan.kind === "RAM") return [{ modelName: plan.ram.modelName, label: null, note: describeRamOption(cpu) }];
  const several = plan.options.length > 1;
  const platformVendors = new Set(plan.options.filter((o) => o.platform).map((o) => o.cpu.vendor));
  return plan.options.map((option) => ({
    modelName: option.cpu.modelName,
    label: several ? cpuOptionLabel(option, platformVendors.size > 1) : null,
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
