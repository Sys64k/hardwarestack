import {
  DESKTOP_VRAM_GIB,
  GPU_BANDWIDTH_EFFICIENCY,
  MOE_GPU_BANDWIDTH_EFFICIENCY,
  PER_TOKEN_OVERHEAD_SECONDS,
  RAM_BANDWIDTH_EFFICIENCY,
  RUNTIME_OVERHEAD_BASE_GIB,
  RUNTIME_OVERHEAD_WEIGHT_SHARE,
  USABLE_RAM_FRACTION,
} from "@/lib/ai-fit";
import { formatPercent } from "@/lib/ai-format";
import { SPEED_TEST } from "@/lib/measured-llm-speed";

const USABLE_RAM = formatPercent(USABLE_RAM_FRACTION);
const PER_TOKEN_MS = PER_TOKEN_OVERHEAD_SECONDS * 1000;

interface Step {
  title: string;
  body: string;
  formula: string[];
  note: string;
}

const STEPS: Step[] = [
  {
    title: "Model weights",
    body: "Every parameter is stored at the chosen compression level. Q4 averages just under 5 bits per weight once block scales are included; FP16 uses the full 16.",
    formula: ["weights = parameters × bitsPerWeight / 8"],
    note: "Q4 4.85 · Q5 5.69 · Q8 8.5 · FP16 16 bits. gpt-oss uses its published MXFP4 checkpoint size.",
  },
  {
    title: "Context memory (KV cache)",
    body: "The model keeps keys and values for every token in the conversation. The size per token comes from each model's published architecture; sliding-window layers only keep their window.",
    formula: ["kv = 2 × layers × kvHeads × headDim × 2 bytes × tokens"],
    note: `Plus runtime overhead for the GPU context and compute buffers: ${RUNTIME_OVERHEAD_BASE_GIB} GB + ${formatPercent(RUNTIME_OVERHEAD_WEIGHT_SHARE)} of the weights.`,
  },
  {
    title: "Does it fit?",
    body: `The desktop and driver hold about ${DESKTOP_VRAM_GIB} GB of VRAM before a model loads, as measured on our test machine; a GPU that doesn't drive a screen has that much more. Whatever doesn't fit can spill into system RAM, of which we assume ${USABLE_RAM} is free for the model.`,
    formula: [`total ≤ VRAM − ${DESKTOP_VRAM_GIB} GB → On GPU`, `spill ≤ ${USABLE_RAM} of RAM → GPU + RAM`],
    note: "Anything larger won't run without more hardware.",
  },
  {
    title: "Speed estimate",
    body: `Generating a token means reading every active weight once, so speed is set by memory bandwidth. Mixture-of-experts models only read their active parameters, which is why they're fast for their size, though they use the GPU's bandwidth less efficiently (${MOE_GPU_BANDWIDTH_EFFICIENCY} instead of ${GPU_BANDWIDTH_EFFICIENCY}).`,
    formula: [
      `seconds = gpuPart / (${GPU_BANDWIDTH_EFFICIENCY} × gpuBW)`,
      `        + ramPart / (${RAM_BANDWIDTH_EFFICIENCY} × ramBW) + ${PER_TOKEN_MS} ms`,
    ],
    note: `Single-user generation speed. The constants are fitted to speeds we measured on an ${SPEED_TEST.gpu}; prompt processing is usually much faster.`,
  },
];

export function LocalAiMethodology() {
  return (
    <section className="mt-12 border-t border-slate-200 pt-10">
      <h2 className="text-lg font-bold text-slate-900 mb-1">How the estimate is calculated</h2>
      <p className="text-sm text-slate-500 mb-8 max-w-2xl">
        The numbers follow how runtimes like llama.cpp, Ollama and LM Studio use memory. Here is exactly how they are
        produced.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        {STEPS.map((step, i) => (
          <div key={step.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                {i + 1}
              </span>
              <h3 className="text-sm font-semibold text-slate-800">{step.title}</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">{step.body}</p>
            <code className="block rounded-md bg-slate-900 px-3 py-2.5 text-[11px] text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
              {step.formula.join("\n")}
            </code>
            <p className="mt-2 text-[11px] text-slate-400">{step.note}</p>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-slate-400 max-w-2xl">
        Estimates are a guide, not a guarantee. Real memory use and speed vary with the runtime, its settings, drivers
        and operating system. GPU memory bandwidths are reference specifications.
      </p>
    </section>
  );
}
