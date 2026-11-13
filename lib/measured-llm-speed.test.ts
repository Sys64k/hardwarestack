import { describe, it, expect } from "vitest";
import { getLlmModel } from "./llm-models";
import {
  MEASURED_SPEEDS,
  getMeasuredSpeed,
  measuredGenerationSpeed,
  speedRows,
} from "./measured-llm-speed";
import { AGENTIC_TEST_RESULTS } from "./agentic-coding-test";

describe("MEASURED_SPEEDS", () => {
  it("only lists models the calculator knows, at their default compression", () => {
    for (const m of MEASURED_SPEEDS) {
      const model = getLlmModel(m.calculatorSlug);
      expect(model, m.calculatorSlug).toBeDefined();
      expect(model!.quants).toContain(m.quant);
    }
  });

  it("never lists a context beyond the model's limit", () => {
    for (const m of MEASURED_SPEEDS) {
      const max = getLlmModel(m.calculatorSlug)!.maxContextTokens;
      for (const p of m.points) expect(p.contextTokens).toBeLessThanOrEqual(max);
    }
  });

  it("lists contexts in ascending order with positive speeds", () => {
    for (const m of MEASURED_SPEEDS) {
      const ctx = m.points.map((p) => p.contextTokens);
      expect(ctx).toEqual([...ctx].sort((a, b) => a - b));
      for (const p of m.points) {
        expect(p.generationTokensPerSecond).toBeGreaterThan(0);
        expect(p.promptTokensPerSecond).toBeGreaterThan(0);
      }
    }
  });

  it("covers every model in the agentic coding test", () => {
    for (const r of AGENTIC_TEST_RESULTS) {
      if (r.calculatorSlug) expect(getMeasuredSpeed(r.calculatorSlug), r.ollamaTag).toBeDefined();
    }
  });
});

describe("measuredGenerationSpeed", () => {
  it("returns the figure at a measured context", () => {
    expect(measuredGenerationSpeed("gpt-oss-20b", 32_768)).toBe(87.1);
  });

  it("returns null for a context that wasn't measured", () => {
    expect(measuredGenerationSpeed("gpt-oss-20b", 4_096)).toBeNull();
    expect(measuredGenerationSpeed("qwen2-5-coder-14b", 65_536)).toBeNull();
  });

  it("returns null for a model that wasn't measured", () => {
    expect(measuredGenerationSpeed("no-such-model", 8_192)).toBeNull();
  });
});

describe("speedRows", () => {
  it("pairs each measured point with the calculator's estimate for the same machine", () => {
    const measured = getMeasuredSpeed("qwen3-coder-30b-a3b")!;
    const rows = speedRows(getLlmModel("qwen3-coder-30b-a3b")!, measured);
    expect(rows.map((r) => r.contextTokens)).toEqual(measured.points.map((p) => p.contextTokens));
    for (const r of rows) expect(r.estimatedTokensPerSecond).toBeGreaterThan(0);
  });

  // The estimator's constants are fitted to these measurements (lib/ai-fit.ts). This keeps
  // a later change to the estimator, or a new measurement, from drifting far from reality.
  const TOLERANCE = 0.25;
  it(`keeps every calculator estimate within ${TOLERANCE * 100}% of the measured speed`, () => {
    for (const m of MEASURED_SPEEDS) {
      for (const r of speedRows(getLlmModel(m.calculatorSlug)!, m)) {
        const ratio = r.estimatedTokensPerSecond! / r.generationTokensPerSecond;
        const label = `${m.ollamaTag} @ ${r.contextTokens}`;
        expect(ratio, label).toBeGreaterThan(1 - TOLERANCE);
        expect(ratio, label).toBeLessThan(1 + TOLERANCE);
      }
    }
  });
});
