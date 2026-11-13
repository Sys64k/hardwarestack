import { describe, it, expect } from "vitest";
import { buildCodingAgentRows, smallestFittingGpu, CODING_AGENT_CONTEXT_TOKENS } from "./coding-agents";
import type { CodingAgentGpu } from "./coding-agents";
import { AGENTIC_TEST_RESULTS } from "./agentic-coding-test";
import { getLlmModel } from "./llm-models";
import type { AgenticTestResult } from "@/types/local-ai";

const gpu = (id: string, vramGb: number, memoryBandwidthGbs = 500): CodingAgentGpu => ({
  id,
  modelName: id,
  vramGb,
  memoryBandwidthGbs,
});
const GPUS = [gpu("24a", 24, 1000), gpu("8", 8), gpu("16", 16), gpu("24b", 24, 900), gpu("32", 32)];

describe("smallestFittingGpu", () => {
  const model = getLlmModel("qwen2-5-coder-14b")!;

  it("picks the smallest-VRAM GPU that holds the whole model", () => {
    expect(smallestFittingGpu(model, "Q4_K_M", CODING_AGENT_CONTEXT_TOKENS, GPUS)?.id).toBe("24b");
  });

  it("returns null when no GPU is big enough", () => {
    expect(smallestFittingGpu(model, "F16", CODING_AGENT_CONTEXT_TOKENS, [gpu("8", 8)])).toBeNull();
  });

  it("returns null for an empty GPU list", () => {
    expect(smallestFittingGpu(model, "Q4_K_M", CODING_AGENT_CONTEXT_TOKENS, [])).toBeNull();
  });
});

describe("buildCodingAgentRows", () => {
  it("builds a row for every tested model, in the data order", () => {
    const rows = buildCodingAgentRows(AGENTIC_TEST_RESULTS, GPUS);
    expect(rows.map((r) => r.result.ollamaTag)).toEqual(AGENTIC_TEST_RESULTS.map((r) => r.ollamaTag));
  });

  it("uses each model's default quant and needs more VRAM than memory", () => {
    const [qwen3Coder] = buildCodingAgentRows(AGENTIC_TEST_RESULTS, GPUS);
    expect(qwen3Coder.quant).toBe("Q4_K_M");
    expect(qwen3Coder.minVramGb).toBeGreaterThan(qwen3Coder.memoryGib);
    expect(qwen3Coder.memoryGib).toBeGreaterThan(16); // matches the test: it didn't fit on a 16 GB GPU
  });

  it("estimates gpt-oss 20B within a 16 GB GPU at 32K", () => {
    const row = buildCodingAgentRows(AGENTIC_TEST_RESULTS, GPUS).find((r) => r.model.slug === "gpt-oss-20b")!;
    expect(row.quant).toBe("MXFP4");
    expect(row.minVramGb).toBeLessThanOrEqual(16);
    expect(row.smallestGpu?.id).toBe("16");
  });

  it("adds the measured speed at the row's context, or null where none was measured", () => {
    const at32k = buildCodingAgentRows(AGENTIC_TEST_RESULTS, GPUS).find((r) => r.model.slug === "gpt-oss-20b")!;
    expect(at32k.measuredTokensPerSecond).toBe(87.1);
    const at4k = buildCodingAgentRows(AGENTIC_TEST_RESULTS, GPUS, 4_096).find((r) => r.model.slug === "gpt-oss-20b")!;
    expect(at4k.measuredTokensPerSecond).toBeNull();
  });

  it("skips results without a calculator model or with an unknown slug", () => {
    const base = AGENTIC_TEST_RESULTS[0];
    const results: AgenticTestResult[] = [
      { ...base, calculatorSlug: null },
      { ...base, calculatorSlug: "no-such-model" },
    ];
    expect(buildCodingAgentRows(results, GPUS)).toEqual([]);
  });

  it("leaves smallestGpu null when nothing fits", () => {
    const rows = buildCodingAgentRows(AGENTIC_TEST_RESULTS, [gpu("8", 8)]);
    expect(rows.every((r) => r.smallestGpu === null)).toBe(true);
  });
});
