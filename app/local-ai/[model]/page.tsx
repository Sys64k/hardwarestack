import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getAgenticTestResult } from "@/lib/agentic-coding-test";
import { DESKTOP_VRAM_GIB, checkFit, estimateMemory, minVramGb } from "@/lib/ai-fit";
import { formatContext, formatGb, formatSpeed } from "@/lib/ai-format";
import { getGpus } from "@/lib/hardware-queries";
import { DEFAULT_CONTEXT_TOKENS, LLM_MODELS, QUANT_LEVELS, defaultQuant, getLlmModel } from "@/lib/llm-models";
import { cn } from "@/lib/utils";
import { ShopLink } from "@/components/monetization/ShopLink";
import { AgenticCodingTestBadge } from "@/components/local-ai/AgenticCodingTest";
import { MeasuredSpeedCard } from "@/components/local-ai/MeasuredSpeedCard";
import { getMeasuredSpeed, speedRows } from "@/lib/measured-llm-speed";
import type { LlmModel } from "@/types/local-ai";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ model: string }>;
}

const CONTEXT_COLUMNS = [4096, 8192, 32_768, 131_072];
const TIER_RANK: Record<string, number> = { ENTRY: 0, MID: 1, HIGH: 2, ULTRA: 3, ENTHUSIAST: 4 };

function formatParams(billions: number): string {
  return `${Number(billions.toFixed(1))}B`;
}

function formatRelease(yyyyMm: string): string {
  return new Date(`${yyyyMm}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function contextColumns(model: LlmModel): number[] {
  const cols = CONTEXT_COLUMNS.filter((c) => c <= model.maxContextTokens);
  return cols.includes(model.maxContextTokens) ? cols : [...cols, model.maxContextTokens];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { model: slug } = await params;
  const model = getLlmModel(slug);
  if (!model) return {};
  const quant = defaultQuant(model);
  const total = estimateMemory(model, quant, DEFAULT_CONTEXT_TOKENS).totalGib;
  return {
    title: `Can I Run ${model.name} Locally? VRAM Requirements`,
    description: `${model.name} needs about ${formatGb(total)} GB of memory at ${QUANT_LEVELS[quant].label} with 8K context. See the VRAM needed at every compression level and which GPUs can run it.`,
    keywords: [
      `${model.name} VRAM`,
      `${model.name} requirements`,
      `run ${model.name} locally`,
      `${model.name} GPU`,
    ],
  };
}

export default async function LocalAiModelPage({ params }: Props) {
  const { model: slug } = await params;
  const model = getLlmModel(slug);
  if (!model) notFound();

  const quant = defaultQuant(model);
  const quantLabel = QUANT_LEVELS[quant].label;
  const memory = estimateMemory(model, quant, DEFAULT_CONTEXT_TOKENS);
  const neededVram = minVramGb(model, quant, DEFAULT_CONTEXT_TOKENS);

  const gpus = await getGpus();
  const fitting = gpus
    .map((gpu) => ({ gpu, fit: checkFit({ model, quant, contextTokens: DEFAULT_CONTEXT_TOKENS, gpu, ram: null }) }))
    .filter((r) => r.fit.status === "gpu")
    .sort((a, b) => a.gpu.vramGb - b.gpu.vramGb || (TIER_RANK[a.gpu.tier] ?? 0) - (TIER_RANK[b.gpu.tier] ?? 0))
    .slice(0, 10);

  const quantsByQuality = [...model.quants].sort(
    (a, b) => QUANT_LEVELS[a].bitsPerWeight - QUANT_LEVELS[b].bitsPerWeight
  );
  const columns = contextColumns(model);
  const otherModels = LLM_MODELS.filter((m) => m.slug !== model.slug);

  const agenticTest = getAgenticTestResult(model.slug);
  const measuredSpeed = getMeasuredSpeed(model.slug);
  const facts: [string, string][] = [
    [
      "Parameters",
      model.activeParamsB
        ? `${formatParams(model.paramsB)} (${formatParams(model.activeParamsB)} active, mixture-of-experts)`
        : formatParams(model.paramsB),
    ],
    ["Max context", `${formatContext(model.maxContextTokens)} tokens`],
    ["License", model.license],
    ["Released", formatRelease(model.releaseDate)],
  ];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-slate-400">
        <Link href="/" className="hover:text-slate-600">
          Home
        </Link>
        <span>/</span>
        <Link href="/local-ai" className="hover:text-slate-600">
          Local AI
        </Link>
        <span>/</span>
        <span className="text-slate-600">{model.name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Can I run {model.name} locally?
            </h1>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              {fitting.length > 0 ? (
                <>
                  <span className="font-semibold text-slate-900">Yes.</span> At {quantLabel} with 8K context,{" "}
                  {model.name} needs about {formatGb(memory.totalGib)} GB, so it runs entirely on any GPU with{" "}
                  {neededVram} GB of VRAM or more, starting with the {fitting[0].gpu.modelName}.
                </>
              ) : (
                <>
                  <span className="font-semibold text-slate-900">Not on a single consumer GPU.</span> Even at{" "}
                  {quantLabel} with 8K context, {model.name} needs about {formatGb(memory.totalGib)} GB. That takes
                  several GPUs, a workstation card, or a machine with a lot of fast system RAM, where it runs slowly.
                </>
              )}
            </p>
          </div>

          {measuredSpeed && (
            <MeasuredSpeedCard
              modelName={model.name}
              ollamaTag={measuredSpeed.ollamaTag}
              rows={speedRows(model, measuredSpeed)}
            />
          )}

          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Memory needed by compression and context length
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-2">Compression</th>
                    {columns.map((c) => (
                      <th key={c} className="px-4 py-2 text-right">
                        {formatContext(c)} context
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quantsByQuality.map((q) => (
                    <tr key={q} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-800">{QUANT_LEVELS[q].label}</div>
                        <div className="text-[11px] text-slate-400">{QUANT_LEVELS[q].description}</div>
                      </td>
                      {columns.map((c) => (
                        <td key={c} className="px-4 py-2.5 text-right tabular-nums text-slate-700 whitespace-nowrap">
                          {formatGb(estimateMemory(model, q, c).totalGib)} GB
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-2.5 border-t border-slate-100 text-[11px] text-slate-400">
              Total memory: model weights, context (KV cache) and runtime overhead. To run entirely on a GPU that also
              drives your screen, VRAM must be about {DESKTOP_VRAM_GIB} GB larger than this.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                GPUs that run {model.name} entirely on the GPU
              </h2>
            </div>
            {fitting.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-600">
                None of the GPUs in our database has the {neededVram} GB of VRAM it needs at {quantLabel}.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {fitting.map(({ gpu, fit }) => (
                  <li key={gpu.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{gpu.modelName}</p>
                      <p className="text-[11px] text-slate-400">
                        {gpu.vramGb} GB · {formatSpeed(fit.tokensPerSecond)} at {quantLabel}
                      </p>
                    </div>
                    <ShopLink modelName={gpu.modelName} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Model facts</h2>
            </div>
            <dl className="divide-y divide-slate-100">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                  <dt className="text-slate-500 shrink-0">{label}</dt>
                  <dd className="font-medium text-slate-800 text-right">{value}</dd>
                </div>
              ))}
            </dl>
            <a
              href={`https://huggingface.co/${model.hfRepo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 hover:text-slate-800"
            >
              View on Hugging Face <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {agenticTest && <AgenticCodingTestBadge result={agenticTest} />}

          <div className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col gap-3">
            <p className="text-sm font-semibold text-slate-800">Check it with your hardware</p>
            <p className="text-xs text-slate-500">
              Change the compression, context length and system RAM in the calculator.
            </p>
            <Link
              href={`/local-ai?model=${model.slug}`}
              className={cn(buttonVariants({ variant: "default", size: "sm" }), "bg-slate-900 hover:bg-slate-700 no-underline")}
            >
              Open calculator
            </Link>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-800 mb-2">Other models</p>
            <ul className="flex flex-col gap-1">
              {otherModels.map((m) => (
                <li key={m.slug}>
                  <Link href={`/local-ai/${m.slug}`} className="text-xs text-slate-500 hover:text-slate-800">
                    {m.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
