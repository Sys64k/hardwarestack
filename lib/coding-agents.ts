import { checkFit, estimateMemory, minVramGb } from "./ai-fit";
import { defaultQuant, getLlmModel } from "./llm-models";
import type { GpuOption } from "@/types/hardware";
import type { AgenticTestResult, LlmModel, QuantId } from "@/types/local-ai";

export const CODING_AGENTS_PATH = "/local-ai/coding-agents";

// The agentic coding test ran with 32K context per conversation (later 64K).
export const CODING_AGENT_CONTEXT_TOKENS = 32_768;

export type CodingAgentGpu = Pick<GpuOption, "id" | "modelName" | "vramGb" | "memoryBandwidthGbs">;

export interface CodingAgentRow {
  result: AgenticTestResult;
  model: LlmModel;
  quant: QuantId;
  memoryGib: number;
  minVramGb: number;
  smallestGpu: CodingAgentGpu | null; // smallest-VRAM GPU in the list that runs it entirely on the GPU
}

export function smallestFittingGpu<T extends CodingAgentGpu>(
  model: LlmModel,
  quant: QuantId,
  contextTokens: number,
  gpus: T[],
): T | null {
  const fitting = gpus
    .filter((gpu) => checkFit({ model, quant, contextTokens, gpu, ram: null }).status === "gpu")
    .sort((a, b) => a.vramGb - b.vramGb || (a.memoryBandwidthGbs ?? 0) - (b.memoryBandwidthGbs ?? 0));
  return fitting[0] ?? null;
}

// Results without a calculator model are left out: there is nothing to estimate.
export function buildCodingAgentRows(
  results: AgenticTestResult[],
  gpus: CodingAgentGpu[],
  contextTokens: number = CODING_AGENT_CONTEXT_TOKENS,
): CodingAgentRow[] {
  return results.flatMap((result) => {
    const model = result.calculatorSlug ? getLlmModel(result.calculatorSlug) : undefined;
    if (!model) return [];
    const quant = defaultQuant(model);
    return [
      {
        result,
        model,
        quant,
        memoryGib: estimateMemory(model, quant, contextTokens).totalGib,
        minVramGb: minVramGb(model, quant, contextTokens),
        smallestGpu: smallestFittingGpu(model, quant, contextTokens, gpus),
      },
    ];
  });
}
