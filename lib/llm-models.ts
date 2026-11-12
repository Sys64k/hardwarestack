import type { LlmModel, QuantId, QuantLevel } from "@/types/local-ai";

export const QUANT_LEVELS: Record<QuantId, QuantLevel> = {
  F16: {
    id: "F16",
    label: "FP16",
    bitsPerWeight: 16,
    description: "Uncompressed. Reference quality, largest size.",
  },
  Q8_0: {
    id: "Q8_0",
    label: "Q8",
    bitsPerWeight: 8.5,
    description: "Practically indistinguishable from FP16 at about half the size.",
  },
  Q5_K_M: {
    id: "Q5_K_M",
    label: "Q5",
    bitsPerWeight: 5.69,
    description: "Very close to full quality.",
  },
  Q4_K_M: {
    id: "Q4_K_M",
    label: "Q4",
    bitsPerWeight: 4.85,
    description: "The most common download. Small quality loss.",
  },
  MXFP4: {
    id: "MXFP4",
    label: "MXFP4",
    bitsPerWeight: 4.25,
    description: "The format the model is released in.",
  },
};

const GGUF_QUANTS: QuantId[] = ["Q4_K_M", "Q5_K_M", "Q8_0", "F16"];

// KV cache sizes are derived from each model's published config.json:
// 2 (K and V) × layers × KV heads × head dim × 2 bytes (FP16).
// DeepSeek R1 uses multi-head latent attention: layers × (kv_lora_rank + rope dim) × 2 bytes.
export const LLM_MODELS: LlmModel[] = [
  // ─── Llama ───────────────────────────────────────────────────────────────
  {
    slug: "llama-3-2-3b",
    name: "Llama 3.2 3B",
    family: "Llama",
    paramsB: 3.21,
    activeParamsB: null,
    kvBytesPerToken: 114_688, // 28 layers × 8 KV heads × 128
    slidingWindowKv: null,
    maxContextTokens: 131_072,
    quants: GGUF_QUANTS,
    license: "Llama 3.2 Community License",
    releaseDate: "2024-09",
    hfRepo: "meta-llama/Llama-3.2-3B-Instruct",
  },
  {
    slug: "llama-3-1-8b",
    name: "Llama 3.1 8B",
    family: "Llama",
    paramsB: 8.03,
    activeParamsB: null,
    kvBytesPerToken: 131_072, // 32 × 8 × 128
    slidingWindowKv: null,
    maxContextTokens: 131_072,
    quants: GGUF_QUANTS,
    license: "Llama 3.1 Community License",
    releaseDate: "2024-07",
    hfRepo: "meta-llama/Llama-3.1-8B-Instruct",
  },
  {
    slug: "llama-3-3-70b",
    name: "Llama 3.3 70B",
    family: "Llama",
    paramsB: 70.55,
    activeParamsB: null,
    kvBytesPerToken: 327_680, // 80 × 8 × 128
    slidingWindowKv: null,
    maxContextTokens: 131_072,
    quants: GGUF_QUANTS,
    license: "Llama 3.3 Community License",
    releaseDate: "2024-12",
    hfRepo: "meta-llama/Llama-3.3-70B-Instruct",
  },
  // ─── Qwen ────────────────────────────────────────────────────────────────
  {
    slug: "qwen3-8b",
    name: "Qwen3 8B",
    family: "Qwen",
    paramsB: 8.19,
    activeParamsB: null,
    kvBytesPerToken: 147_456, // 36 × 8 × 128
    slidingWindowKv: null,
    maxContextTokens: 32_768,
    quants: GGUF_QUANTS,
    license: "Apache 2.0",
    releaseDate: "2025-04",
    hfRepo: "Qwen/Qwen3-8B",
  },
  {
    slug: "qwen3-14b",
    name: "Qwen3 14B",
    family: "Qwen",
    paramsB: 14.77,
    activeParamsB: null,
    kvBytesPerToken: 163_840, // 40 × 8 × 128
    slidingWindowKv: null,
    maxContextTokens: 32_768,
    quants: GGUF_QUANTS,
    license: "Apache 2.0",
    releaseDate: "2025-04",
    hfRepo: "Qwen/Qwen3-14B",
  },
  {
    slug: "qwen3-32b",
    name: "Qwen3 32B",
    family: "Qwen",
    paramsB: 32.76,
    activeParamsB: null,
    kvBytesPerToken: 262_144, // 64 × 8 × 128
    slidingWindowKv: null,
    maxContextTokens: 32_768,
    quants: GGUF_QUANTS,
    license: "Apache 2.0",
    releaseDate: "2025-04",
    hfRepo: "Qwen/Qwen3-32B",
  },
  {
    slug: "qwen3-30b-a3b",
    name: "Qwen3 30B-A3B",
    family: "Qwen",
    paramsB: 30.53,
    activeParamsB: 3.3,
    kvBytesPerToken: 98_304, // 48 × 4 × 128
    slidingWindowKv: null,
    maxContextTokens: 32_768,
    quants: GGUF_QUANTS,
    license: "Apache 2.0",
    releaseDate: "2025-04",
    hfRepo: "Qwen/Qwen3-30B-A3B",
  },
  {
    slug: "qwen3-235b-a22b",
    name: "Qwen3 235B-A22B",
    family: "Qwen",
    paramsB: 235.09,
    activeParamsB: 22,
    kvBytesPerToken: 192_512, // 94 × 4 × 128
    slidingWindowKv: null,
    maxContextTokens: 32_768,
    quants: GGUF_QUANTS,
    license: "Apache 2.0",
    releaseDate: "2025-04",
    hfRepo: "Qwen/Qwen3-235B-A22B",
  },
  {
    slug: "qwen3-coder-30b-a3b",
    name: "Qwen3-Coder 30B-A3B",
    family: "Qwen",
    paramsB: 30.53,
    activeParamsB: 3.3,
    kvBytesPerToken: 98_304, // 48 × 4 × 128
    slidingWindowKv: null,
    maxContextTokens: 262_144,
    quants: GGUF_QUANTS,
    license: "Apache 2.0",
    releaseDate: "2025-07",
    hfRepo: "Qwen/Qwen3-Coder-30B-A3B-Instruct",
  },
  {
    slug: "qwen2-5-coder-14b",
    name: "Qwen2.5-Coder 14B",
    family: "Qwen",
    paramsB: 14.77,
    activeParamsB: null,
    kvBytesPerToken: 196_608, // 48 × 8 × 128
    slidingWindowKv: null,
    maxContextTokens: 32_768,
    quants: GGUF_QUANTS,
    license: "Apache 2.0",
    releaseDate: "2024-11",
    hfRepo: "Qwen/Qwen2.5-Coder-14B-Instruct",
  },
  // ─── Mistral ─────────────────────────────────────────────────────────────
  {
    slug: "mistral-7b",
    name: "Mistral 7B v0.3",
    family: "Mistral",
    paramsB: 7.25,
    activeParamsB: null,
    kvBytesPerToken: 131_072, // 32 × 8 × 128
    slidingWindowKv: null,
    maxContextTokens: 32_768,
    quants: GGUF_QUANTS,
    license: "Apache 2.0",
    releaseDate: "2024-05",
    hfRepo: "mistralai/Mistral-7B-Instruct-v0.3",
  },
  {
    slug: "mistral-nemo-12b",
    name: "Mistral Nemo 12B",
    family: "Mistral",
    paramsB: 12.25,
    activeParamsB: null,
    kvBytesPerToken: 163_840, // 40 × 8 × 128
    slidingWindowKv: null,
    maxContextTokens: 131_072,
    quants: GGUF_QUANTS,
    license: "Apache 2.0",
    releaseDate: "2024-07",
    hfRepo: "mistralai/Mistral-Nemo-Instruct-2407",
  },
  {
    slug: "mistral-small-3-1-24b",
    name: "Mistral Small 3.1 24B",
    family: "Mistral",
    paramsB: 24.01,
    activeParamsB: null,
    kvBytesPerToken: 163_840, // 40 × 8 × 128
    slidingWindowKv: null,
    maxContextTokens: 131_072,
    quants: GGUF_QUANTS,
    license: "Apache 2.0",
    releaseDate: "2025-03",
    hfRepo: "mistralai/Mistral-Small-3.1-24B-Instruct-2503",
  },
  {
    slug: "devstral-small-24b",
    name: "Devstral Small 24B",
    family: "Mistral",
    paramsB: 23.57,
    activeParamsB: null,
    kvBytesPerToken: 163_840, // 40 × 8 × 128
    slidingWindowKv: null,
    maxContextTokens: 131_072,
    quants: GGUF_QUANTS,
    license: "Apache 2.0",
    releaseDate: "2025-07",
    hfRepo: "mistralai/Devstral-Small-2507",
  },
  // ─── Gemma ───────────────────────────────────────────────────────────────
  // Gemma 3: every 6th layer uses global attention, the rest a 1024-token sliding window.
  {
    slug: "gemma-3-4b",
    name: "Gemma 3 4B",
    family: "Gemma",
    paramsB: 4.3,
    activeParamsB: null,
    kvBytesPerToken: 20_480, // 5 global layers × 4 KV heads × 256
    slidingWindowKv: { windowTokens: 1024, bytesPerToken: 118_784 }, // 29 local layers
    maxContextTokens: 131_072,
    quants: GGUF_QUANTS,
    license: "Gemma Terms of Use",
    releaseDate: "2025-03",
    hfRepo: "google/gemma-3-4b-it",
  },
  {
    slug: "gemma-3-12b",
    name: "Gemma 3 12B",
    family: "Gemma",
    paramsB: 12.19,
    activeParamsB: null,
    kvBytesPerToken: 65_536, // 8 global layers × 8 × 256
    slidingWindowKv: { windowTokens: 1024, bytesPerToken: 327_680 }, // 40 local layers
    maxContextTokens: 131_072,
    quants: GGUF_QUANTS,
    license: "Gemma Terms of Use",
    releaseDate: "2025-03",
    hfRepo: "google/gemma-3-12b-it",
  },
  {
    slug: "gemma-3-27b",
    name: "Gemma 3 27B",
    family: "Gemma",
    paramsB: 27.43,
    activeParamsB: null,
    kvBytesPerToken: 81_920, // 10 global layers × 16 × 128
    slidingWindowKv: { windowTokens: 1024, bytesPerToken: 425_984 }, // 52 local layers
    maxContextTokens: 131_072,
    quants: GGUF_QUANTS,
    license: "Gemma Terms of Use",
    releaseDate: "2025-03",
    hfRepo: "google/gemma-3-27b-it",
  },
  // ─── Phi ─────────────────────────────────────────────────────────────────
  {
    slug: "phi-4-14b",
    name: "Phi-4 14B",
    family: "Phi",
    paramsB: 14.66,
    activeParamsB: null,
    kvBytesPerToken: 204_800, // 40 × 10 × 128
    slidingWindowKv: null,
    maxContextTokens: 16_384,
    quants: GGUF_QUANTS,
    license: "MIT",
    releaseDate: "2024-12",
    hfRepo: "microsoft/phi-4",
  },
  // ─── DeepSeek ────────────────────────────────────────────────────────────
  {
    slug: "deepseek-r1-671b",
    name: "DeepSeek R1 671B",
    family: "DeepSeek",
    paramsB: 671,
    activeParamsB: 37,
    kvBytesPerToken: 70_272, // 61 × (512 + 64) × 2
    slidingWindowKv: null,
    maxContextTokens: 131_072,
    quants: ["Q4_K_M", "Q8_0"],
    license: "MIT",
    releaseDate: "2025-01",
    hfRepo: "deepseek-ai/DeepSeek-R1",
  },
  // ─── GLM ─────────────────────────────────────────────────────────────────
  // Multi-head latent attention, like DeepSeek. The parameter count includes the
  // multi-token-prediction layer from the published checkpoint.
  {
    slug: "glm-4-7-flash",
    name: "GLM-4.7-Flash 30B-A3B",
    family: "GLM",
    paramsB: 31.22,
    activeParamsB: 3, // "30B-A3B" per the model card
    kvBytesPerToken: 54_144, // 47 × (512 + 64) × 2
    slidingWindowKv: null,
    maxContextTokens: 202_752,
    quants: GGUF_QUANTS,
    license: "MIT",
    releaseDate: "2026-01",
    hfRepo: "zai-org/GLM-4.7-Flash",
  },
  // ─── gpt-oss ─────────────────────────────────────────────────────────────
  // Released in MXFP4; half the layers use a 128-token sliding window.
  {
    slug: "gpt-oss-20b",
    name: "gpt-oss 20B",
    family: "gpt-oss",
    paramsB: 20.91,
    activeParamsB: 3.6,
    kvBytesPerToken: 24_576, // 12 full layers × 8 × 64
    slidingWindowKv: { windowTokens: 128, bytesPerToken: 24_576 },
    maxContextTokens: 131_072,
    quants: ["MXFP4"],
    quantBitsOverride: { MXFP4: 5.26 }, // 13.76 GB checkpoint
    license: "Apache 2.0",
    releaseDate: "2025-08",
    hfRepo: "openai/gpt-oss-20b",
  },
  {
    slug: "gpt-oss-120b",
    name: "gpt-oss 120B",
    family: "gpt-oss",
    paramsB: 116.83,
    activeParamsB: 5.1,
    kvBytesPerToken: 36_864, // 18 full layers × 8 × 64
    slidingWindowKv: { windowTokens: 128, bytesPerToken: 36_864 },
    maxContextTokens: 131_072,
    quants: ["MXFP4"],
    quantBitsOverride: { MXFP4: 4.47 }, // 65.25 GB checkpoint
    license: "Apache 2.0",
    releaseDate: "2025-08",
    hfRepo: "openai/gpt-oss-120b",
  },
];

export function getLlmModel(slug: string): LlmModel | undefined {
  return LLM_MODELS.find((m) => m.slug === slug);
}

// Q4 is what most people download; pre-quantised models only have their native format.
export function defaultQuant(model: LlmModel): QuantId {
  return model.quants.includes("Q4_K_M") ? "Q4_K_M" : model.quants[0];
}

// Context length used for summaries outside the interactive calculator.
export const DEFAULT_CONTEXT_TOKENS = 8192;
