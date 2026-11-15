"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { checkFit, compareFittingGpus, estimateMemory, minVramGb, recommendQuant } from "@/lib/ai-fit";
import type { FitResult, SystemRamSpec } from "@/lib/ai-fit";
import { DEFAULT_CONTEXT_TOKENS, LLM_MODELS, QUANT_LEVELS, defaultQuant, getLlmModel } from "@/lib/llm-models";
import { buildPcPartPickerUrl } from "@/lib/shopping-links";
import { ShopLink } from "@/components/monetization/ShopLink";
import { formatGb, formatSpeed } from "@/lib/ai-format";
import { StatusBadge } from "@/components/local-ai/StatusBadge";
import type { GpuOption } from "@/types/hardware";
import type { QuantId } from "@/types/local-ai";
import { TIER_LABELS, groupByTier, type WithGamingTier } from "@/lib/tiers";

export type LocalAiGpu = WithGamingTier<Pick<GpuOption, "id" | "modelName" | "vramGb" | "memoryBandwidthGbs">>;

type Mode = "gpu" | "model";
type RamType = "DDR4" | "DDR5";

const RAM_SIZES = [16, 32, 64, 128] as const;
// Typical dual-channel kits; only used for the offload speed estimate.
const RAM_SPEED_MTS: Record<RamType, number> = { DDR4: 3200, DDR5: 5600 };

const CONTEXT_OPTIONS = [
  { tokens: 4096, label: "4K" },
  { tokens: 8192, label: "8K" },
  { tokens: 32_768, label: "32K" },
  { tokens: 131_072, label: "128K" },
] as const;

const labelClass = "text-[10px] font-semibold text-slate-500 uppercase tracking-wider";

function MemoryBar({ fit }: { fit: FitResult }) {
  const pct = Math.min(100, (fit.memory.totalGib / fit.usableVramGib) * 100);
  const color = fit.status === "gpu" ? "bg-emerald-500" : fit.status === "partial" ? "bg-amber-500" : "bg-slate-300";
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-100 p-0.5">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 h-full rounded px-2 text-xs font-semibold transition-all ${
            value === opt.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface LocalAiCalculatorProps {
  gpus: LocalAiGpu[];
  defaultGpuId?: string;
  defaultModelSlug?: string;
}

export function LocalAiCalculator({ gpus, defaultGpuId, defaultModelSlug }: LocalAiCalculatorProps) {
  const initialModel = defaultModelSlug ? getLlmModel(defaultModelSlug) : undefined;
  const initialGpu = gpus.find((g) => g.id === defaultGpuId);

  const [mode, setMode] = useState<Mode>(initialModel && !initialGpu ? "model" : "gpu");
  const [gpuId, setGpuId] = useState(initialGpu?.id ?? "");
  const [ramGb, setRamGb] = useState<number>(32);
  const [ramType, setRamType] = useState<RamType>("DDR5");
  const [contextTokens, setContextTokens] = useState<number>(DEFAULT_CONTEXT_TOKENS);
  const [modelSlug, setModelSlug] = useState(initialModel?.slug ?? "");
  const [quant, setQuant] = useState<QuantId>(initialModel ? defaultQuant(initialModel) : "Q4_K_M");

  const ram: SystemRamSpec = { capacityGb: ramGb, speedMhz: RAM_SPEED_MTS[ramType], channels: 2 };
  const selectedGpu = gpus.find((g) => g.id === gpuId) ?? null;
  const selectedModel = modelSlug ? getLlmModel(modelSlug) ?? null : null;

  function handleModelChange(slug: string) {
    setModelSlug(slug);
    const m = getLlmModel(slug);
    if (m && !m.quants.includes(quant)) setQuant(m.quants[0]);
  }

  const gpuGroups = groupByTier(gpus, (g) => g.gamingTier).map(({ tier, items }) => ({
    label: TIER_LABELS[tier],
    options: items.map((g) => ({ value: g.id, label: g.modelName, meta: `${g.vramGb} GB` })),
  }));

  const modelGroups = [...new Set(LLM_MODELS.map((m) => m.family))].map((family) => ({
    label: family,
    options: LLM_MODELS.filter((m) => m.family === family).map((m) => ({
      value: m.slug,
      label: m.name,
      meta: m.activeParamsB ? "MoE" : undefined,
    })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4 flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            {mode === "gpu" ? "Your Hardware" : "Your Model"}
          </CardTitle>
          <div className="w-44 sm:w-56 shrink-0">
            <Segmented<Mode>
              options={[
                { value: "gpu", label: "By GPU" },
                { value: "model", label: "By model" },
              ]}
              value={mode}
              onChange={setMode}
            />
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 lg:grid-cols-[3fr_2fr_2fr]">
          {mode === "gpu" ? (
            <>
              <div className="col-span-2 lg:col-span-1 flex flex-col gap-1.5">
                <Label className={labelClass}>GPU</Label>
                <SearchableSelect
                  value={gpuId}
                  onValueChange={setGpuId}
                  placeholder="Select GPU…"
                  searchPlaceholder="Search GPUs…"
                  groups={gpuGroups}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className={labelClass}>System RAM</Label>
                <Segmented<number>
                  options={RAM_SIZES.map((gb) => ({ value: gb, label: `${gb}` }))}
                  value={ramGb}
                  onChange={setRamGb}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className={labelClass}>RAM type</Label>
                <Segmented<RamType>
                  options={[
                    { value: "DDR4", label: "DDR4" },
                    { value: "DDR5", label: "DDR5" },
                  ]}
                  value={ramType}
                  onChange={setRamType}
                />
              </div>
            </>
          ) : (
            <>
              <div className="col-span-2 lg:col-span-1 flex flex-col gap-1.5">
                <Label className={labelClass}>Model</Label>
                <SearchableSelect
                  value={modelSlug}
                  onValueChange={handleModelChange}
                  placeholder="Select model…"
                  searchPlaceholder="Search models…"
                  groups={modelGroups}
                />
              </div>
              <div className="col-span-2 sm:col-span-1 flex flex-col gap-1.5">
                <Label className={labelClass}>Compression</Label>
                <Segmented<QuantId>
                  options={(selectedModel?.quants ?? ["Q4_K_M", "Q5_K_M", "Q8_0", "F16"]).map((q) => ({
                    value: q,
                    label: QUANT_LEVELS[q].label,
                  }))}
                  value={quant}
                  onChange={setQuant}
                />
              </div>
            </>
          )}
          <div className="col-span-2 sm:col-span-1 flex flex-col gap-1.5">
            <Label className={labelClass}>Context length</Label>
            <Segmented<number>
              options={CONTEXT_OPTIONS.map((c) => ({ value: c.tokens, label: c.label }))}
              value={contextTokens}
              onChange={setContextTokens}
            />
          </div>
        </CardContent>
      </Card>

      {mode === "gpu" &&
        (selectedGpu ? (
          <ModelsForGpu gpu={selectedGpu} ram={ram} contextTokens={contextTokens} />
        ) : (
          <EmptyState text="Select your GPU to see which AI models it can run locally." />
        ))}

      {mode === "model" &&
        (selectedModel ? (
          <GpusForModel
            modelSlug={selectedModel.slug}
            quant={quant}
            contextTokens={contextTokens}
            gpus={gpus}
            ram={ram}
          />
        ) : (
          <EmptyState text="Select a model to see how much memory it needs and which GPUs can run it." />
        ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function ModelsForGpu({
  gpu,
  ram,
  contextTokens,
}: {
  gpu: LocalAiGpu;
  ram: SystemRamSpec;
  contextTokens: number;
}) {
  const rows = [...LLM_MODELS]
    .sort((a, b) => a.paramsB - b.paramsB)
    .map((model) => ({ model, rec: recommendQuant(model, contextTokens, gpu, ram) }));
  const onGpu = rows.filter((r) => r.rec.fit.status === "gpu").length;

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-800">
          {onGpu} of {rows.length} models run entirely on the {gpu.modelName.replace(/^(NVIDIA GeForce|AMD Radeon) /, "")}
        </CardTitle>
        <p className="text-xs text-slate-500">
          {gpu.vramGb} GB VRAM, {ram.capacityGb} GB system RAM. Each model is shown at the best compression level that
          fits{gpu.memoryBandwidthGbs === null ? ". Speed estimates aren't available for this GPU yet." : "."}
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-2 pr-3">Model</th>
                <th className="py-2 pr-3">Runs</th>
                <th className="py-2 pr-3 min-w-28">Memory</th>
                <th className="py-2 text-right">Speed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ model, rec }) => (
                <tr key={model.slug} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-3">
                    <Link href={`/local-ai/${model.slug}`} className="font-medium text-slate-800 hover:underline">
                      {model.name}
                    </Link>
                    <div className="text-[11px] text-slate-400">
                      {QUANT_LEVELS[rec.quant].label}
                      {model.activeParamsB ? ` · MoE, ${model.activeParamsB}B active` : ""}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <StatusBadge status={rec.fit.status} />
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="text-xs text-slate-600 mb-1 whitespace-nowrap">
                      {formatGb(rec.fit.memory.totalGib)} GB
                    </div>
                    <MemoryBar fit={rec.fit} />
                  </td>
                  <td className="py-2.5 text-right text-xs text-slate-600 whitespace-nowrap">
                    {formatSpeed(rec.fit.tokensPerSecond)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function GpusForModel({
  modelSlug,
  quant,
  contextTokens,
  gpus,
  ram,
}: {
  modelSlug: string;
  quant: QuantId;
  contextTokens: number;
  gpus: LocalAiGpu[];
  ram: SystemRamSpec;
}) {
  const model = getLlmModel(modelSlug);
  if (!model) return null;

  const memory = estimateMemory(model, quant, contextTokens);
  const neededVram = minVramGb(model, quant, contextTokens);
  const clamped = contextTokens > model.maxContextTokens;

  const fitting = gpus
    .map((gpu) => ({ gpu, fit: checkFit({ model, quant, contextTokens, gpu, ram }) }))
    .filter((r) => r.fit.status === "gpu")
    .sort((a, b) => compareFittingGpus(a.gpu, b.gpu))
    .slice(0, 8);

  const breakdown = [
    { label: "Model weights", gib: memory.weightsGib },
    { label: "Context (KV cache)", gib: memory.kvCacheGib },
    { label: "Runtime overhead", gib: memory.overheadGib },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-800">
            <Link href={`/local-ai/${model.slug}`} className="hover:underline">
              {model.name}
            </Link>{" "}
            at {QUANT_LEVELS[quant].label} needs about {formatGb(memory.totalGib)} GB
          </CardTitle>
          <p className="text-xs text-slate-500">{QUANT_LEVELS[quant].description}</p>
        </CardHeader>
        <CardContent className="pt-0 flex flex-col gap-3">
          <dl className="flex flex-col gap-1.5 text-sm">
            {breakdown.map((row) => (
              <div key={row.label} className="flex justify-between">
                <dt className="text-slate-500">{row.label}</dt>
                <dd className="font-medium text-slate-800">{formatGb(row.gib)} GB</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 pt-1.5">
              <dt className="font-semibold text-slate-800">Total</dt>
              <dd className="font-semibold text-slate-900">{formatGb(memory.totalGib)} GB</dd>
            </div>
          </dl>
          <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Runs entirely on a GPU with <span className="font-semibold">{neededVram} GB</span> of VRAM or more.
            {clamped && ` Context is capped at the model's maximum of ${model.maxContextTokens / 1024}K tokens.`}
          </p>
          <p className="text-[11px] text-slate-400">
            {model.license} ·{" "}
            <a
              href={`https://huggingface.co/${model.hfRepo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-600"
            >
              Hugging Face
            </a>
          </p>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-800">GPUs that run it entirely on the GPU</CardTitle>
          <p className="text-xs text-slate-500">Smallest VRAM first. Speeds are estimates for one GPU.</p>
        </CardHeader>
        <CardContent className="pt-0">
          {fitting.length === 0 ? (
            <p className="rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-600">
              No single GPU in our database has enough VRAM. Running it locally takes several GPUs, a workstation
              card, or offloading most of it to system RAM, which is very slow.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100">
              {fitting.map(({ gpu, fit }) => (
                <li key={gpu.id} className="flex items-center gap-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{gpu.modelName}</p>
                    <p className="text-[11px] text-slate-400">
                      {gpu.vramGb} GB · {formatSpeed(fit.tokensPerSecond)}
                    </p>
                  </div>
                  <a
                    href={buildPcPartPickerUrl(gpu.modelName)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
                  >
                    PCPartPicker <ExternalLink className="h-3 w-3" />
                  </a>
                  <ShopLink modelName={gpu.modelName} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
