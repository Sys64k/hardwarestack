"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { RESOLUTIONS, calculateBottleneck } from "@/lib/bottleneck";
import { pairHref } from "@/lib/pair-pages";
import { SOCKET_LABELS, SOCKET_ORDER, isRamCompatible, ramTypesForSocket } from "@/lib/platform";
import type {
  CpuOption,
  GpuOption,
  RamOption,
  Resolution,
} from "@/types/hardware";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { BottleneckGauge } from "./BottleneckGauge";
import { UpgradeCard } from "@/components/monetization/UpgradeCard";
import { LocalAiTeaser } from "@/components/local-ai/LocalAiTeaser";

interface Props {
  cpus: CpuOption[];
  gpus: GpuOption[];
  rams: RamOption[];
  defaultCpuId?: string;
  defaultGpuId?: string;
  onResultChange?: (
    result: import("@/types/hardware").BottleneckResult | null,
    cpu: CpuOption | null,
    gpu: GpuOption | null,
    resolution: Resolution
  ) => void;
}

const TIER_ORDER = ["ENTRY", "MID", "HIGH", "ULTRA", "ENTHUSIAST"] as const;
const TIER_LABELS: Record<string, string> = {
  ENTRY: "Entry",
  MID: "Mid-Range",
  HIGH: "High-End",
  ULTRA: "Ultra",
  ENTHUSIAST: "Enthusiast",
};

function groupByTier<T extends { tier: string }>(
  items: T[]
): { tier: string; items: T[] }[] {
  return TIER_ORDER.filter((t) => items.some((i) => i.tier === t)).map(
    (tier) => ({ tier, items: items.filter((i) => i.tier === tier) })
  );
}

function groupBySocket(
  items: CpuOption[]
): { socket: string; items: CpuOption[] }[] {
  const present = [...new Set(items.map((c) => c.socket ?? "Unknown"))];
  const ordered = SOCKET_ORDER.filter((s) => present.includes(s));
  const rest = present.filter((s) => !SOCKET_ORDER.includes(s as never));
  return [...ordered, ...rest].map((socket) => ({
    socket,
    items: items
      .filter((c) => (c.socket ?? "Unknown") === socket)
      .sort(
        (a, b) =>
          TIER_ORDER.indexOf(b.tier as never) -
          TIER_ORDER.indexOf(a.tier as never)
      ),
  }));
}

const HEADLINE: Record<string, string> = {
  CPU: "CPU Bottleneck",
  GPU: "GPU Bottleneck",
  RAM: "RAM Bottleneck",
  Balanced: "Well Matched",
};

const DESCRIPTION: Record<string, (cpu: string, gpu: string, res: string) => string> = {
  CPU: (cpu, _gpu, res) =>
    `${cpu} is the limiting factor at ${res}. A faster CPU will unlock your GPU's full potential.`,
  GPU: (_cpu, gpu, res) =>
    `${gpu} can't keep up at ${res}. A GPU upgrade will directly improve frame rates.`,
  RAM: (_cpu, _gpu, res) =>
    `Slow or single-channel RAM is starving your CPU at ${res}. Faster dual-channel memory will deliver measurable FPS gains.`,
  Balanced: (cpu, gpu, res) =>
    `${cpu} and ${gpu} are well matched at ${res}.`,
};

const RESULT_ACCENT: Record<string, string> = {
  CPU: "border-l-red-500",
  GPU: "border-l-red-500",
  RAM: "border-l-amber-500",
  Balanced: "border-l-emerald-500",
};

function shortName(name: string): string {
  return name
    .replace("Intel Core ", "")
    .replace("AMD Ryzen ", "Ryzen ")
    .replace("NVIDIA GeForce ", "")
    .replace("AMD Radeon ", "");
}

export function BottleneckCalculator({
  cpus,
  gpus,
  rams,
  defaultCpuId,
  defaultGpuId,
  onResultChange,
}: Props) {
  const [selectedCpuId, setSelectedCpuId] = useState(
    defaultCpuId && cpus.some((c) => c.id === defaultCpuId) ? defaultCpuId : ""
  );
  const [selectedGpuId, setSelectedGpuId] = useState(
    defaultGpuId && gpus.some((g) => g.id === defaultGpuId) ? defaultGpuId : ""
  );
  const [selectedRamId, setSelectedRamId] = useState("");
  const [resolution, setResolution] = useState<Resolution>("1080p");

  const selectedCpu = cpus.find((c) => c.id === selectedCpuId);
  const selectedGpu = gpus.find((g) => g.id === selectedGpuId);
  const selectedRam = rams.find((r) => r.id === selectedRamId);

  const compatibleRamTypes = ramTypesForSocket(selectedCpu?.socket ?? null);
  const compatibleRams = rams.filter((r) => isRamCompatible(selectedCpu?.socket ?? null, r.type));

  function handleCpuChange(v: string) {
    setSelectedCpuId(v);
    const newCpu = cpus.find((c) => c.id === v);
    if (newCpu && selectedRam && !isRamCompatible(newCpu.socket, selectedRam.type)) setSelectedRamId("");
  }

  const result =
    selectedCpu && selectedGpu
      ? calculateBottleneck(selectedCpu, selectedGpu, resolution, selectedRam)
      : null;

  useEffect(() => {
    onResultChange?.(result, selectedCpu ?? null, selectedGpu ?? null, resolution);
  }, [selectedCpuId, selectedGpuId, selectedRamId, resolution, onResultChange]); // eslint-disable-line react-hooks/exhaustive-deps

  const cpuGroups = groupBySocket(cpus);
  const gpuGroups = groupByTier(gpus);
  const ramGroups = groupByTier(compatibleRams);

  const pairUrl = selectedCpu && selectedGpu ? pairHref(selectedCpu, selectedGpu) : null;

  const showUpgrade =
    result && result.bottleneckComponent !== "Balanced" && selectedCpu && selectedGpu;

  return (
    <div className="flex flex-col gap-5">
      {/* Selector card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Your Components
          </CardTitle>
          {(selectedCpuId || selectedGpuId || selectedRamId) && (
            <button
              onClick={() => {
                setSelectedCpuId("");
                setSelectedGpuId("");
                setSelectedRamId("");
                setResolution("1080p");
              }}
              className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 shadow-sm hover:border-slate-300 hover:text-slate-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
              Reset
            </button>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 lg:grid-cols-[2fr_2fr_2fr_1fr]">
          {/* CPU */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              CPU
            </Label>
            <SearchableSelect
              value={selectedCpuId}
              onValueChange={(v) => handleCpuChange(v)}
              placeholder="Select CPU…"
              searchPlaceholder="Search CPUs…"
              groups={cpuGroups.map(({ socket, items }) => ({
                label: SOCKET_LABELS[socket] ?? socket,
                options: items.map(cpu => ({
                  value: cpu.id,
                  label: cpu.modelName,
                  meta: TIER_LABELS[cpu.tier],
                })),
              }))}
            />
          </div>

          {/* GPU */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              GPU
            </Label>
            <SearchableSelect
              value={selectedGpuId}
              onValueChange={(v) => setSelectedGpuId(v)}
              placeholder="Select GPU…"
              searchPlaceholder="Search GPUs…"
              groups={gpuGroups.map(({ tier, items }) => ({
                label: TIER_LABELS[tier],
                options: items.map(gpu => ({ value: gpu.id, label: gpu.modelName })),
              }))}
            />
          </div>

          {/* RAM */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              RAM{" "}
              {compatibleRamTypes ? (
                <span className="normal-case font-normal text-slate-400">
                  ({compatibleRamTypes.join(" / ")} only)
                </span>
              ) : (
                <span className="normal-case font-normal text-slate-400">
                  (optional)
                </span>
              )}
            </Label>
            <SearchableSelect
              value={selectedRamId}
              onValueChange={(v) => setSelectedRamId(v)}
              placeholder="Select RAM…"
              searchPlaceholder="Search RAM…"
              groups={ramGroups.map(({ tier, items }) => ({
                label: TIER_LABELS[tier],
                options: items.map(ram => ({ value: ram.id, label: ram.modelName })),
              }))}
            />
          </div>

          {/* Resolution */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Resolution
            </Label>
            <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-100 p-0.5">
              {RESOLUTIONS.map((res) => (
                <button
                  key={res}
                  onClick={() => setResolution(res)}
                  className={`flex-1 rounded text-xs font-semibold transition-all h-full ${
                    resolution === res
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && selectedCpu && selectedGpu ? (
        <Card
          className={`border-slate-200 shadow-sm border-l-4 ${RESULT_ACCENT[result.bottleneckComponent]}`}
        >
          <CardContent className="pt-5 pb-5 flex flex-col gap-5">
            {/* Headline */}
            <div>
              <div className="flex items-baseline gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {HEADLINE[result.bottleneckComponent]}
                </h2>
                {result.bottleneckComponent !== "Balanced" && (
                  <span className="text-sm font-semibold text-red-500">
                    {Math.round(result.bottleneckPercentage)}% imbalance
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {DESCRIPTION[result.bottleneckComponent](
                  shortName(selectedCpu.modelName),
                  shortName(selectedGpu.modelName),
                  resolution
                )}
              </p>
              {pairUrl && (
                <Link
                  href={pairUrl}
                  className="mt-2 inline-block text-xs text-slate-400 hover:text-slate-700"
                >
                  All resolutions for this pair, shareable link →
                </Link>
              )}
            </div>

            {/* Gauges */}
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
              <BottleneckGauge
                label={shortName(selectedCpu.modelName)}
                utilization={result.cpuUtilization}
                isBottleneck={result.bottleneckComponent === "CPU"}
              />
              <BottleneckGauge
                label={shortName(selectedGpu.modelName)}
                utilization={result.gpuUtilization}
                isBottleneck={result.bottleneckComponent === "GPU"}
              />
              {selectedRam && (
                <BottleneckGauge
                  label={`${selectedRam.type}-${selectedRam.speedMhz}${selectedRam.channels === 1 ? " SC" : ""}`}
                  utilization={result.ramUtilization}
                  isBottleneck={result.bottleneckComponent === "RAM"}
                />
              )}
            </div>

            {/* Upgrade recommendation */}
            {showUpgrade && (
              <UpgradeCard
                bottleneckComponent={
                  result.bottleneckComponent as "CPU" | "GPU" | "RAM"
                }
                cpu={selectedCpu}
                gpu={selectedGpu}
                ram={selectedRam}
                cpus={cpus}
                gpus={gpus}
                rams={rams}
                resolution={resolution}
              />
            )}

            <LocalAiTeaser gpu={selectedGpu} gpuLabel={shortName(selectedGpu.modelName)} />
          </CardContent>
        </Card>
      ) : (
        /* Empty prompt */
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-6 py-9 text-center">
          <div className="flex justify-center gap-5 mb-3.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-2 opacity-20"
              >
                <div className="h-12 w-12 rounded-full border-[3px] border-slate-400" />
                <div className="h-1.5 w-10 rounded bg-slate-300" />
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-400">
            Select a CPU and GPU above to see the analysis
          </p>
        </div>
      )}
    </div>
  );
}
