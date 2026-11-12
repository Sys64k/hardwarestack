import type { Metadata } from "next";
import Link from "next/link";
import { AGENTIC_TEST_VRAM_GB } from "@/lib/agentic-coding-test";
import { CODING_AGENTS_PATH } from "@/lib/coding-agents";
import { MethodologySection } from "@/components/calculator/MethodologySection";
import { CalculatorSection } from "@/components/CalculatorSection";
import { ToolTabs } from "@/components/ToolTabs";
import { getCpus, getGpus, getRams } from "@/lib/hardware-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PC Bottleneck Calculator",
};

interface HomePageProps {
  searchParams: Promise<{ cpuId?: string; gpuId?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const [cpus, gpus, rams, { cpuId, gpuId }] = await Promise.all([
    getCpus(),
    getGpus(),
    getRams(),
    searchParams,
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      <p className="mb-3 text-sm text-slate-500">
        HardwareStack checks how your hardware performs, for gaming and for running AI models locally.
      </p>
      <ToolTabs active="gaming" />
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          PC Bottleneck Calculator
        </h1>
        <p className="mt-2 text-slate-500 max-w-xl text-sm sm:text-base">
          Select your CPU and GPU to instantly calculate which component limits
          your gaming performance — and by how much.
        </p>
        <Link
          href={CODING_AGENTS_PATH}
          className="mt-3 inline-block text-xs text-slate-500 underline hover:text-slate-800"
        >
          From my own tests: which local AI models can drive a coding agent on a {AGENTIC_TEST_VRAM_GB} GB GPU →
        </Link>
      </div>

      {cpus.length === 0 || gpus.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
          <p className="font-medium text-slate-700">No hardware data found.</p>
          <p className="mt-1">
            Run{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
              npm run db:seed
            </code>{" "}
            to populate the database with CPUs, GPUs, and RAM kits.
          </p>
        </div>
      ) : (
        <CalculatorSection
          cpus={cpus}
          gpus={gpus}
          rams={rams}
          defaultCpuId={cpuId}
          defaultGpuId={gpuId}
        >
          <MethodologySection />
        </CalculatorSection>
      )}
    </main>
  );
}
