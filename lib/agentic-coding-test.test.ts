import { describe, it, expect } from "vitest";
import {
  AGENTIC_TEST_LEVELS,
  AGENTIC_TEST_RESULTS,
  AGENTIC_TEST_URL,
  agenticTestResultUrl,
  formatAgenticTestScore,
  getAgenticTestResult,
  describeTestsFirstGain,
  summarizeAgenticResults,
} from "./agentic-coding-test";
import { getLlmModel } from "./llm-models";
import type { AgenticTestResult } from "@/types/local-ai";

function result(overrides: Partial<AgenticTestResult>): AgenticTestResult {
  return {
    ollamaTag: "x:1b",
    name: "X 1B",
    anchor: "x-1b",
    levelsPassed: 2,
    levelsPassedTestsFirst: null,
    ranPartlyOnCpu: false,
    calculatorSlug: null,
    ...overrides,
  };
}

describe("agentic coding test data", () => {
  it("lists exactly the five tested models", () => {
    expect(AGENTIC_TEST_RESULTS.map((r) => r.ollamaTag)).toEqual([
      "qwen3-coder:30b",
      "glm-4.7-flash",
      "gpt-oss:20b",
      "devstral:24b",
      "qwen2.5-coder:14b",
    ]);
  });

  it("keeps every score within the level count", () => {
    for (const r of AGENTIC_TEST_RESULTS) {
      expect(r.levelsPassed).toBeGreaterThanOrEqual(0);
      expect(r.levelsPassed).toBeLessThanOrEqual(AGENTIC_TEST_LEVELS);
      if (r.levelsPassedTestsFirst !== null) {
        expect(r.levelsPassedTestsFirst).toBeGreaterThanOrEqual(0);
        expect(r.levelsPassedTestsFirst).toBeLessThanOrEqual(AGENTIC_TEST_LEVELS);
      }
    }
  });

  it("uses unique, well-formed anchors", () => {
    const anchors = AGENTIC_TEST_RESULTS.map((r) => r.anchor);
    expect(new Set(anchors).size).toBe(anchors.length);
    for (const a of anchors) expect(a).toMatch(/^[a-z0-9-]+$/);
  });

  it("doesn't let a model slug shadow the /local-ai/coding-agents page", () => {
    expect(getLlmModel("coding-agents")).toBeUndefined();
  });

  it("links every tested model to a calculator model that exists", () => {
    for (const r of AGENTIC_TEST_RESULTS) {
      expect(r.calculatorSlug).not.toBeNull();
      expect(getLlmModel(r.calculatorSlug!)).toBeDefined();
    }
  });
});

describe("agenticTestResultUrl", () => {
  it("points at the model's anchor on the results page", () => {
    expect(agenticTestResultUrl(result({ anchor: "gpt-oss-20b" }))).toBe(`${AGENTIC_TEST_URL}#gpt-oss-20b`);
  });
});

describe("formatAgenticTestScore", () => {
  it("shows only the solo score when tests first wasn't run on all levels", () => {
    expect(formatAgenticTestScore(result({ levelsPassed: 3 }))).toBe("3 of 5");
  });

  it("shows zero scores", () => {
    expect(formatAgenticTestScore(result({ levelsPassed: 0 }))).toBe("0 of 5");
  });

  it("adds the tests-first score when there is one", () => {
    expect(formatAgenticTestScore(result({ levelsPassed: 3, levelsPassedTestsFirst: 4 }))).toBe(
      "3 of 5 alone, 4 of 5 with tests written first",
    );
  });
});

describe("getAgenticTestResult", () => {
  it("finds a tested model by its calculator slug", () => {
    expect(getAgenticTestResult("gpt-oss-20b")?.ollamaTag).toBe("gpt-oss:20b");
  });

  it("returns undefined for an untested model", () => {
    expect(getAgenticTestResult("llama-3-1-8b")).toBeUndefined();
  });

  it("returns undefined for an unknown slug", () => {
    expect(getAgenticTestResult("no-such-model")).toBeUndefined();
  });
});

describe("summarizeAgenticResults", () => {
  it("summarises the published results", () => {
    expect(summarizeAgenticResults(AGENTIC_TEST_RESULTS)).toEqual({
      total: 5,
      passedNone: 2,
      passedSome: 3,
      testsFirstRuns: 2,
      testsFirstImproved: 2,
    });
  });

  it("doesn't count a tests-first run that passed no more levels", () => {
    const s = summarizeAgenticResults([result({ levelsPassed: 3, levelsPassedTestsFirst: 3 })]);
    expect(s.testsFirstRuns).toBe(1);
    expect(s.testsFirstImproved).toBe(0);
  });

  it("handles an empty list", () => {
    expect(summarizeAgenticResults([])).toEqual({
      total: 0,
      passedNone: 0,
      passedSome: 0,
      testsFirstRuns: 0,
      testsFirstImproved: 0,
    });
  });
});

describe("describeTestsFirstGain", () => {
  const summary = (testsFirstImproved: number, testsFirstRuns: number) => ({
    total: 5,
    passedNone: 0,
    passedSome: 5,
    testsFirstRuns,
    testsFirstImproved,
  });

  it("says both when the two runs both improved", () => {
    expect(describeTestsFirstGain(summary(2, 2))).toBe("both");
  });

  it("says all N for more than two", () => {
    expect(describeTestsFirstGain(summary(3, 3))).toBe("all 3");
  });

  it("gives a fraction when only some improved", () => {
    expect(describeTestsFirstGain(summary(1, 3))).toBe("1 of the 3");
  });
});
