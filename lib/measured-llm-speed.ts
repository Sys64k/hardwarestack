import { checkFit } from "./ai-fit";
import type { GpuSpec, SystemRamSpec } from "./ai-fit";
import type { LlmModel, QuantId } from "@/types/local-ai";

// Speeds measured on my own machine (avalon) with scripts/bench/ollama-speed.mjs, the
// same box and models as the ASO agentic coding test. Each figure is the median of
// SPEED_TEST.runs runs after a warm-up; runs agreed within 1%. Copied from the script's
// JSON report (ollamaVersion, measuredAt, promptTokens per model).

// The test machine in the estimator's terms, so the page can show the estimate next to
// the measurement. The labels below are derived from these.
export const SPEED_TEST_GPU: GpuSpec = { vramGb: 16, memoryBandwidthGbs: 448 };
export const SPEED_TEST_RAM: SystemRamSpec = { capacityGb: 48, speedMhz: 3200, channels: 2 };

export const SPEED_TEST = {
  gpu: `RTX 5060 Ti ${SPEED_TEST_GPU.vramGb} GB`,
  cpu: "AMD Ryzen 7 5700X",
  ramLabel: `${SPEED_TEST_RAM.capacityGb} GB DDR4-${SPEED_TEST_RAM.speedMhz}`,
  ollamaVersion: "0.40.11",
  measured: "2026-11",
  runs: 3,
  promptTokens: 3_300, // about: 3,270–4,709 depending on the model's tokenizer
  generatedTokens: 256,
  desktopVramGb: 2, // used by the desktop session before each model loaded
  scriptUrl: "https://github.com/Sys64k/hardwarestack/blob/main/scripts/bench/ollama-speed.mjs",
} as const;

export interface SpeedPoint {
  contextTokens: number;              // context window reserved (num_ctx)
  promptTokensPerSecond: number;      // reading the prompt
  generationTokensPerSecond: number;  // writing the answer
}

export interface MeasuredSpeed {
  calculatorSlug: string;
  ollamaTag: string;
  quant: QuantId;
  points: SpeedPoint[];
}

export const MEASURED_SPEEDS: MeasuredSpeed[] = [
  {
    calculatorSlug: "gpt-oss-20b",
    ollamaTag: "gpt-oss:20b",
    quant: "MXFP4",
    points: [
      { contextTokens: 8_192, promptTokensPerSecond: 5336, generationTokensPerSecond: 93.3 },
      { contextTokens: 32_768, promptTokensPerSecond: 5183, generationTokensPerSecond: 87.1 },
      { contextTokens: 65_536, promptTokensPerSecond: 3479, generationTokensPerSecond: 69.2 },
    ],
  },
  {
    calculatorSlug: "qwen3-coder-30b-a3b",
    ollamaTag: "qwen3-coder:30b",
    quant: "Q4_K_M",
    points: [
      { contextTokens: 8_192, promptTokensPerSecond: 804, generationTokensPerSecond: 55.7 },
      { contextTokens: 32_768, promptTokensPerSecond: 642, generationTokensPerSecond: 45.9 },
      { contextTokens: 65_536, promptTokensPerSecond: 498, generationTokensPerSecond: 37.1 },
    ],
  },
  {
    calculatorSlug: "glm-4-7-flash",
    ollamaTag: "glm-4.7-flash",
    quant: "Q4_K_M",
    points: [
      { contextTokens: 8_192, promptTokensPerSecond: 708, generationTokensPerSecond: 50.7 },
      { contextTokens: 32_768, promptTokensPerSecond: 613, generationTokensPerSecond: 45.9 },
      { contextTokens: 65_536, promptTokensPerSecond: 525, generationTokensPerSecond: 40.3 },
    ],
  },
  {
    calculatorSlug: "qwen2-5-coder-14b",
    ollamaTag: "qwen2.5-coder:14b",
    quant: "Q4_K_M",
    // No 64K point: the model's limit is 32K, so Ollama capped that run at 32K.
    points: [
      { contextTokens: 8_192, promptTokensPerSecond: 1851, generationTokensPerSecond: 41.9 },
      { contextTokens: 32_768, promptTokensPerSecond: 1303, generationTokensPerSecond: 16.5 },
    ],
  },
  {
    calculatorSlug: "devstral-small-24b",
    ollamaTag: "devstral:24b",
    quant: "Q4_K_M",
    points: [
      { contextTokens: 8_192, promptTokensPerSecond: 1139, generationTokensPerSecond: 10.4 },
      { contextTokens: 32_768, promptTokensPerSecond: 836, generationTokensPerSecond: 5.8 },
      { contextTokens: 65_536, promptTokensPerSecond: 695, generationTokensPerSecond: 4.3 },
    ],
  },
];

export function getMeasuredSpeed(calculatorSlug: string): MeasuredSpeed | undefined {
  return MEASURED_SPEEDS.find((m) => m.calculatorSlug === calculatorSlug);
}

// Measured generation speed at exactly this context; null when it wasn't measured.
export function measuredGenerationSpeed(calculatorSlug: string, contextTokens: number): number | null {
  const point = getMeasuredSpeed(calculatorSlug)?.points.find((p) => p.contextTokens === contextTokens);
  return point?.generationTokensPerSecond ?? null;
}

export interface SpeedRow extends SpeedPoint {
  estimatedTokensPerSecond: number | null; // this site's estimate for the same machine
}

// Measured points next to what the calculator estimates for the test machine.
export function speedRows(model: LlmModel, measured: MeasuredSpeed): SpeedRow[] {
  return measured.points.map((p) => ({
    ...p,
    estimatedTokensPerSecond: checkFit({
      model,
      quant: measured.quant,
      contextTokens: p.contextTokens,
      gpu: SPEED_TEST_GPU,
      ram: SPEED_TEST_RAM,
    }).tokensPerSecond,
  }));
}
