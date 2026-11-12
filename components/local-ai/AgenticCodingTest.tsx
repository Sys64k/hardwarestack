import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  AGENTIC_TEST_CAVEAT,
  AGENTIC_TEST_CPU_NOTE,
  AGENTIC_TEST_GPU,
  AGENTIC_TEST_LEVELS,
  AGENTIC_TEST_RESULTS,
  AGENTIC_TEST_URL,
  agenticTestResultUrl,
  formatAgenticTestScore,
} from "@/lib/agentic-coding-test";
import { CODING_AGENTS_PATH } from "@/lib/coding-agents";
import type { AgenticTestResult } from "@/types/local-ai";

// Score linked to the model's section of the results page.
export function AgenticScore({ result }: { result: AgenticTestResult }) {
  return (
    <a
      href={agenticTestResultUrl(result)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900"
    >
      {formatAgenticTestScore(result)} <ExternalLink className="h-3 w-3 text-slate-400" />
    </a>
  );
}

export function AgenticCodingTest() {
  return (
    <section className="mt-12 border-t border-slate-200 pt-10">
      <h2 className="text-lg font-bold text-slate-900 mb-1">Agentic coding test</h2>
      <p className="text-sm text-slate-500 mb-6 max-w-2xl">
        From my own ASO experiment: {AGENTIC_TEST_RESULTS.length} Ollama models each drove a coding agent through a ladder of{" "}
        {AGENTIC_TEST_LEVELS} tasks on an {AGENTIC_TEST_GPU}. {AGENTIC_TEST_CAVEAT}
      </p>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-2">Model</th>
              <th className="px-4 py-2 text-right">Levels passed</th>
            </tr>
          </thead>
          <tbody>
            {AGENTIC_TEST_RESULTS.map((r) => (
              <tr key={r.ollamaTag} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5">
                  {r.calculatorSlug ? (
                    <Link
                      href={`/local-ai/${r.calculatorSlug}`}
                      className="font-mono text-[13px] font-medium text-slate-800 hover:text-slate-600"
                    >
                      {r.ollamaTag}
                    </Link>
                  ) : (
                    <code className="font-mono text-[13px] font-medium text-slate-800">{r.ollamaTag}</code>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <AgenticScore result={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-400 max-w-2xl">
        {AGENTIC_TEST_CPU_NOTE}{" "}
        <a href={AGENTIC_TEST_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">
          Full results and method
        </a>
        , or{" "}
        <Link href={CODING_AGENTS_PATH} className="underline hover:text-slate-600">
          see how much VRAM each model needs
        </Link>
        .
      </p>
    </section>
  );
}

export function AgenticCodingTestBadge({ result }: { result: AgenticTestResult }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-800 mb-1">Agentic coding test</p>
      <p className="text-xs text-slate-500 mb-2">
        Levels passed: <span className="font-semibold text-slate-800">{formatAgenticTestScore(result)}</span>, from my
        own ASO experiment on an {AGENTIC_TEST_GPU}. {AGENTIC_TEST_CAVEAT}
      </p>
      <a
        href={agenticTestResultUrl(result)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
      >
        See the result <ExternalLink className="h-3 w-3" />
      </a>
      <Link href={CODING_AGENTS_PATH} className="mt-1 block text-xs text-slate-500 hover:text-slate-800">
        Compare all {AGENTIC_TEST_RESULTS.length} tested models →
      </Link>
    </div>
  );
}
