import { describe, it, expect } from "vitest";
import { formatContext, formatGb, formatMeasuredSpeed, formatSpeed } from "./ai-format";
import { defaultQuant, getLlmModel } from "./llm-models";

describe("formatting", () => {
  it("shows one decimal below 10 and whole numbers above", () => {
    expect(formatGb(6.534)).toBe("6.5");
    expect(formatGb(43.33)).toBe("43");
    expect(formatGb(9.97)).toBe("10");
    expect(formatSpeed(2.43)).toBe("~2.4 tok/s");
    expect(formatSpeed(38.9)).toBe("~39 tok/s");
    expect(formatSpeed(null)).toBe("—");
    expect(formatContext(32_768)).toBe("32K");
    expect(formatContext(131_072)).toBe("128K");
  });
});

describe("defaultQuant", () => {
  it("prefers Q4 and falls back to the native format", () => {
    expect(defaultQuant(getLlmModel("llama-3-1-8b")!)).toBe("Q4_K_M");
    expect(defaultQuant(getLlmModel("gpt-oss-20b")!)).toBe("MXFP4");
  });
});

describe("formatMeasuredSpeed", () => {
  it("rounds to whole tok/s from 10 up, without a tilde", () => {
    expect(formatMeasuredSpeed(87.1)).toBe("87 tok/s");
    expect(formatMeasuredSpeed(10)).toBe("10 tok/s");
  });

  it("keeps one decimal below 10", () => {
    expect(formatMeasuredSpeed(4.34)).toBe("4.3 tok/s");
  });

  it("shows a dash when nothing was measured", () => {
    expect(formatMeasuredSpeed(null)).toBe("—");
  });
});
