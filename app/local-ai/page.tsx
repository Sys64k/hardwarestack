import type { Metadata } from "next";
import { LocalAiCalculator } from "@/components/local-ai/LocalAiCalculator";
import type { LocalAiGpu } from "@/components/local-ai/LocalAiCalculator";
import { AgenticCodingTest } from "@/components/local-ai/AgenticCodingTest";
import { LocalAiMethodology } from "@/components/local-ai/LocalAiMethodology";
import { getGpus } from "@/lib/hardware-queries";
import { ToolTabs } from "@/components/ToolTabs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Can I Run This AI Model Locally? LLM VRAM Calculator",
  description:
    "Check which local AI models (Llama, Qwen, Gemma, Mistral, DeepSeek, gpt-oss) your GPU can run, how much VRAM each needs, and how fast it will be.",
};

interface LocalAiPageProps {
  searchParams: Promise<{ gpuId?: string; model?: string }>;
}

export default async function LocalAiPage({ searchParams }: LocalAiPageProps) {
  const [allGpus, { gpuId, model }] = await Promise.all([getGpus(), searchParams]);
  const gpus: LocalAiGpu[] = allGpus.map(({ id, modelName, tier, vramGb, memoryBandwidthGbs }) => ({
    id,
    modelName,
    tier,
    vramGb,
    memoryBandwidthGbs,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      <ToolTabs active="ai" />
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Can I Run This AI Model Locally?
        </h1>
        <p className="mt-2 text-slate-500 max-w-xl text-sm sm:text-base">
          Pick your GPU to see which open AI models it can run and how fast, or pick a model to see how much memory it
          needs and which GPUs can handle it.
        </p>
      </div>

      <LocalAiCalculator gpus={gpus} defaultGpuId={gpuId} defaultModelSlug={model} />
      <AgenticCodingTest />
      <LocalAiMethodology />
    </main>
  );
}
