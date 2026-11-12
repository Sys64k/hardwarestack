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
import type { AgenticTestResult } from "@/types/local-ai";

export function AgenticCodingTest() {
  return (
    <section className="mt-12 border-t border-slate-200 pt-10">
      <h2 className="text-lg font-bold text-slate-900 mb-1">Agentic coding test</h2>
      <p className="text-sm text-slate-500 mb-6 max-w-2xl">
        From my own ASO experiment: five Ollama models each drove a coding agent through a ladder of{" "}
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
                  <a
                    href={agenticTestResultUrl(r)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-slate-800 hover:text-slate-600"
                  >
                    <code className="font-mono text-[13px]">{r.ollamaTag}</code>
                    <ExternalLink className="h-3 w-3 text-slate-400" />
                  </a>
                  {r.ranPartlyOnCpu && (
                    <p className="text-[11px] text-slate-400">{AGENTIC_TEST_CPU_NOTE}</p>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right text-slate-700">{formatAgenticTestScore(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-400 max-w-2xl">
        Running partly on the CPU makes a model slower, not worse.{" "}
        <a href={AGENTIC_TEST_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">
          Full results and method
        </a>
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
    </div>
  );
}
