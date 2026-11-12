import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ToolTabs } from "@/components/ToolTabs";
import { ShopLink } from "@/components/monetization/ShopLink";
import { AgenticScore } from "@/components/local-ai/AgenticCodingTest";
import {
  AGENTIC_TEST_CAVEAT,
  AGENTIC_TEST_GPU,
  AGENTIC_TEST_LEVELS,
  AGENTIC_TEST_RESULTS,
  AGENTIC_TEST_URL,
  AGENTIC_TEST_VRAM_GB,
  describeTestsFirstGain,
  summarizeAgenticResults,
} from "@/lib/agentic-coding-test";
import { formatContext, formatGb } from "@/lib/ai-format";
import { CODING_AGENT_CONTEXT_TOKENS, buildCodingAgentRows } from "@/lib/coding-agents";
import { getGpus } from "@/lib/hardware-queries";
import { QUANT_LEVELS } from "@/lib/llm-models";

export const dynamic = "force-dynamic";

const CONTEXT_LABEL = formatContext(CODING_AGENT_CONTEXT_TOKENS);
const SUMMARY = summarizeAgenticResults(AGENTIC_TEST_RESULTS);
const TITLE = `Which local models can drive a coding agent on a ${AGENTIC_TEST_VRAM_GB} GB GPU?`;

export const metadata: Metadata = {
  title: TITLE,
  description: `${SUMMARY.total} Ollama models (${AGENTIC_TEST_RESULTS.map((r) => r.ollamaTag).join(", ")}) ran a ${AGENTIC_TEST_LEVELS}-task agentic coding test on an ${AGENTIC_TEST_GPU}. See what passed, how much VRAM each needs and which GPUs run it.`,
  keywords: [
    "local coding agent",
    "local LLM for coding 16 GB GPU",
    "ollama coding agent model",
    "qwen3-coder VRAM",
    "glm-4.7-flash VRAM",
  ],
};

export default async function CodingAgentsPage() {
  const gpus = await getGpus();
  const rows = buildCodingAgentRows(AGENTIC_TEST_RESULTS, gpus);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      <ToolTabs active="ai" />
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-slate-400">
        <Link href="/local-ai" className="hover:text-slate-600">
          Local AI
        </Link>
        <span>/</span>
        <span className="text-slate-600">Coding agents</span>
      </nav>

      <div className="mb-8 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {TITLE}
        </h1>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          In my own ASO experiment, {SUMMARY.total} Ollama models each drove a coding agent through a ladder of{" "}
          {AGENTIC_TEST_LEVELS} tasks on an {AGENTIC_TEST_GPU}. On their own, {SUMMARY.passedSome} passed at least one
          level and {SUMMARY.passedNone} passed none. Writing the tests first lifted{" "}
          {describeTestsFirstGain(SUMMARY)} models that tried it on every level.
        </p>
        <p className="mt-2 text-xs text-slate-500">{AGENTIC_TEST_CAVEAT}</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Test result and memory needed at {CONTEXT_LABEL} context
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-2">Model</th>
                <th className="px-4 py-2">Levels passed</th>
                <th className="px-4 py-2 text-right">Memory</th>
                <th className="px-4 py-2 text-right">VRAM to stay on GPU</th>
                <th className="px-4 py-2">Smallest GPU that fits</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.result.ollamaTag} className="border-b border-slate-100 last:border-0 align-top">
                  <td className="px-4 py-3">
                    <Link
                      href={`/local-ai/${row.model.slug}`}
                      className="font-medium text-slate-800 hover:text-slate-600"
                    >
                      {row.model.name}
                    </Link>
                    <div className="font-mono text-[11px] text-slate-400">{row.result.ollamaTag}</div>
                  </td>
                  <td className="px-4 py-3">
                    <AgenticScore result={row.result} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 whitespace-nowrap">
                    {formatGb(row.memoryGib)} GB
                    <div className="text-[11px] text-slate-400">{QUANT_LEVELS[row.quant].label}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 whitespace-nowrap">
                    {row.minVramGb} GB
                  </td>
                  <td className="px-4 py-3">
                    {row.smallestGpu ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-700">{row.smallestGpu.modelName}</span>
                        <ShopLink modelName={row.smallestGpu.modelName} />
                      </div>
                    ) : (
                      <span className="text-slate-400">None in our database</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2.5 border-t border-slate-100 text-[11px] text-slate-400">
          Memory and VRAM are this site&apos;s estimates at {CONTEXT_LABEL} context, the context the test started with.
          They weren&apos;t measured in the test. A model that doesn&apos;t fit can still run with part of it in system
          RAM, which makes it slower, not worse.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <a
          href={AGENTIC_TEST_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-300"
        >
          <p className="text-sm font-semibold text-slate-800 mb-1 inline-flex items-center gap-1">
            Full results and method <ExternalLink className="h-3 w-3" />
          </p>
          <p className="text-xs text-slate-500">
            Every level, every retry, what went wrong and which failures were the harness rather than the model.
          </p>
        </a>
        <Link href="/local-ai" className="rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-300">
          <p className="text-sm font-semibold text-slate-800 mb-1">Check with your own GPU →</p>
          <p className="text-xs text-slate-500">
            Change compression, context length and system RAM in the local AI calculator.
          </p>
        </Link>
      </div>
    </main>
  );
}
