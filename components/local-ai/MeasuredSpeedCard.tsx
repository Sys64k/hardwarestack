import { formatContext, formatMeasuredSpeed, formatSpeed } from "@/lib/ai-format";
import { SPEED_TEST, type SpeedRow } from "@/lib/measured-llm-speed";

interface Props {
  modelName: string;
  ollamaTag: string;
  rows: SpeedRow[];
}

export function MeasuredSpeedCard({ modelName, ollamaTag, rows }: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Measured speed on my {SPEED_TEST.gpu}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-2">Context</th>
              <th className="px-4 py-2 text-right">Writing</th>
              <th className="px-4 py-2 text-right">Reading the prompt</th>
              <th className="px-4 py-2 text-right">Calculator estimate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.contextTokens} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5 text-slate-700">{formatContext(r.contextTokens)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                  {formatMeasuredSpeed(r.generationTokensPerSecond)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 whitespace-nowrap">
                  {formatMeasuredSpeed(r.promptTokensPerSecond)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-400 whitespace-nowrap">
                  {formatSpeed(r.estimatedTokensPerSecond)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2.5 border-t border-slate-100 text-[11px] text-slate-400 leading-relaxed">
        <code className="font-mono">{ollamaTag}</code> in Ollama {SPEED_TEST.ollamaVersion} on {SPEED_TEST.cpu},{" "}
        {SPEED_TEST.ramLabel}, with the desktop using about {SPEED_TEST.desktopVramGb} GB of VRAM. Median of {SPEED_TEST.runs} runs: a
        prompt of about {SPEED_TEST.promptTokens.toLocaleString("en-US")} tokens of code, then{" "}
        {SPEED_TEST.generatedTokens} tokens written. Context is the window reserved, not filled; a nearly full window
        is slower. Where the window doesn&apos;t fit in VRAM, part of {modelName} runs on the CPU.{" "}
        <a href={SPEED_TEST.scriptUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">
          Benchmark script
        </a>
        .
      </p>
    </div>
  );
}
