import { describe, it, expect } from "vitest";
import {
  GPU_BANDWIDTH_EFFICIENCY,
  MOE_GPU_BANDWIDTH_EFFICIENCY,
  bitsPerWeight,
  checkFit,
  estimateMemory,
  gpuBandwidthEfficiency,
  minVramGb,
  recommendQuant,
} from "./ai-fit";
import { LLM_MODELS, getLlmModel } from "./llm-models";
import type { GpuSpec, SystemRamSpec } from "./ai-fit";
import type { LlmModel } from "@/types/local-ai";

const model = (slug: string): LlmModel => {
  const m = getLlmModel(slug);
  if (!m) throw new Error(`missing model ${slug}`);
  return m;
};

const rtx4060Ti: GpuSpec = { vramGb: 8, memoryBandwidthGbs: 288 };
const rtx5060Ti: GpuSpec = { vramGb: 16, memoryBandwidthGbs: 448 };
const rtx4090: GpuSpec = { vramGb: 24, memoryBandwidthGbs: 1008 };
const ddr5x64: SystemRamSpec = { capacityGb: 64, speedMhz: 6000, channels: 2 };
const ddr5x16: SystemRamSpec = { capacityGb: 16, speedMhz: 6000, channels: 2 };

describe("estimateMemory", () => {
  it("sums weights, KV cache and runtime overhead", () => {
    const mem = estimateMemory(model("llama-3-1-8b"), "Q4_K_M", 8192);
    expect(mem.weightsGib).toBeCloseTo(4.53, 2);
    expect(mem.kvCacheGib).toBeCloseTo(1.0, 5);
    expect(mem.overheadGib).toBeCloseTo(0.2 + 0.05 * 4.534, 2); // grows with the weights
    expect(mem.totalGib).toBeCloseTo(5.96, 2);
  });

  it("caps sliding-window layers at the window size", () => {
    const mem = estimateMemory(model("gemma-3-27b"), "Q4_K_M", 32_768);
    expect(mem.kvCacheGib).toBeCloseTo(2.5 + 0.40625, 5);
  });

  it("clamps the context to the model's maximum", () => {
    const mem = estimateMemory(model("phi-4-14b"), "Q4_K_M", 131_072);
    expect(mem.kvCacheGib).toBeCloseTo(3.125, 5);
  });

  it("uses measured checkpoint sizes for pre-quantised models", () => {
    const mem = estimateMemory(model("gpt-oss-20b"), "MXFP4", 8192);
    expect(mem.weightsGib).toBeCloseTo(12.8, 1);
  });
});

describe("bitsPerWeight", () => {
  it("rejects quantisations the model isn't published in", () => {
    expect(() => bitsPerWeight(model("gpt-oss-20b"), "Q4_K_M")).toThrow();
  });
});

describe("checkFit", () => {
  it("runs a small model entirely on an 8 GB card", () => {
    const fit = checkFit({
      model: model("llama-3-1-8b"),
      quant: "Q4_K_M",
      contextTokens: 4096,
      gpu: rtx4060Ti,
      ram: null,
    });
    expect(fit.status).toBe("gpu");
    expect(fit.usableVramGib).toBe(6); // 8 GB minus the desktop's 2 GB
    expect(fit.gpuWeightShare).toBe(1);
    expect(fit.tokensPerSecond).toBeCloseTo(41, 0);
  });

  it("leaves no usable VRAM on a card smaller than the desktop's share", () => {
    const fit = checkFit({
      model: model("llama-3-1-8b"),
      quant: "Q4_K_M",
      contextTokens: 4096,
      gpu: { vramGb: 1, memoryBandwidthGbs: 100 },
      ram: ddr5x64,
    });
    expect(fit.usableVramGib).toBe(0);
    expect(fit.gpuWeightShare).toBe(0);
    expect(fit.status).toBe("partial");
  });

  it("needs RAM once the context outgrows the card", () => {
    const fit = checkFit({
      model: model("llama-3-1-8b"),
      quant: "Q4_K_M",
      contextTokens: 16_384,
      gpu: rtx4060Ti,
      ram: null,
    });
    expect(fit.status).toBe("none"); // 6.96 GiB needed, 6 usable, and no RAM given
  });

  it("offloads a 70B model to system RAM when there is enough of it", () => {
    const fit = checkFit({
      model: model("llama-3-3-70b"),
      quant: "Q4_K_M",
      contextTokens: 8192,
      gpu: rtx4090,
      ram: ddr5x64,
    });
    expect(fit.status).toBe("partial");
    expect(fit.gpuWeightShare).toBeCloseTo(0.435, 2);
    expect(fit.tokensPerSecond).toBeCloseTo(2.9, 1);
  });

  it("matches which runs stayed entirely in VRAM on the 16 GB test machine", () => {
    // Ollama kept gpt-oss 20B fully on the GPU at 8K and spilled ~9% to RAM at 32K.
    const at = (contextTokens: number) =>
      checkFit({ model: model("gpt-oss-20b"), quant: "MXFP4", contextTokens, gpu: rtx5060Ti, ram: ddr5x64 }).status;
    expect(at(8192)).toBe("gpu");
    expect(at(32_768)).toBe("partial");
  });

  it("reports no fit when VRAM plus usable RAM is too small", () => {
    const fit = checkFit({
      model: model("llama-3-3-70b"),
      quant: "Q4_K_M",
      contextTokens: 8192,
      gpu: rtx4090,
      ram: ddr5x16,
    });
    expect(fit.status).toBe("none");
    expect(fit.tokensPerSecond).toBeNull();
  });

  it("estimates speed from active parameters for mixture-of-experts models", () => {
    const fit = checkFit({
      model: model("qwen3-30b-a3b"),
      quant: "Q4_K_M",
      contextTokens: 8192,
      gpu: rtx4090,
      ram: null,
    });
    expect(fit.status).toBe("gpu");
    expect(fit.tokensPerSecond).toBeCloseTo(229, 0);
  });

  it("still checks fit when the GPU's bandwidth is unknown", () => {
    const fit = checkFit({
      model: model("llama-3-1-8b"),
      quant: "Q4_K_M",
      contextTokens: 4096,
      gpu: { vramGb: 8, memoryBandwidthGbs: null },
      ram: null,
    });
    expect(fit.status).toBe("gpu");
    expect(fit.tokensPerSecond).toBeNull();
  });
});

describe("recommendQuant", () => {
  it("picks the highest quality that fits entirely on the GPU", () => {
    // At 4K context, 8B needs ~5.5 GiB at Q4 and ~6.3 GiB at Q5 (8 GB card: 6 usable).
    expect(recommendQuant(model("llama-3-1-8b"), 4096, rtx4060Ti, null).quant).toBe("Q4_K_M");
    expect(recommendQuant(model("llama-3-1-8b"), 8192, rtx4090, null).quant).toBe("F16");
  });

  it("falls back to the smallest quantisation when nothing fits on the GPU", () => {
    const rec = recommendQuant(model("llama-3-3-70b"), 8192, rtx4090, ddr5x64);
    expect(rec.quant).toBe("Q4_K_M");
    expect(rec.fit.status).toBe("partial");
  });
});

describe("gpuBandwidthEfficiency", () => {
  it("gives mixture-of-experts models the lower efficiency", () => {
    expect(gpuBandwidthEfficiency(model("qwen3-coder-30b-a3b"))).toBe(MOE_GPU_BANDWIDTH_EFFICIENCY);
    expect(gpuBandwidthEfficiency(model("qwen2-5-coder-14b"))).toBe(GPU_BANDWIDTH_EFFICIENCY);
  });
});

describe("minVramGb", () => {
  it("rounds up to the smallest whole-GB card that fits", () => {
    expect(minVramGb(model("llama-3-1-8b"), "Q4_K_M", 8192)).toBe(8); // 5.96 + 2 desktop
    expect(minVramGb(model("llama-3-1-8b"), "Q4_K_M", 16_384)).toBe(9);
    expect(minVramGb(model("llama-3-3-70b"), "Q4_K_M", 8192)).toBe(47);
  });
});

describe("LLM_MODELS", () => {
  it("has unique slugs", () => {
    const slugs = LLM_MODELS.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(LLM_MODELS.map((m) => [m.slug, m] as const))("%s is internally consistent", (_, m) => {
    expect(m.quants.length).toBeGreaterThan(0);
    expect(m.paramsB).toBeGreaterThan(0);
    expect(m.activeParamsB ?? m.paramsB).toBeLessThanOrEqual(m.paramsB);
    expect(m.kvBytesPerToken).toBeGreaterThan(0);
    expect(m.maxContextTokens).toBeGreaterThan(0);
    expect(m.releaseDate).toMatch(/^\d{4}-\d{2}$/);
  });
});
