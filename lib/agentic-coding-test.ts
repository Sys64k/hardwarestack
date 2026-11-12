import type { AgenticTestResult } from "@/types/local-ai";

// Results from the ASO local-model experiment. To update, edit the numbers below
// to match the results page; nothing else needs to change.
export const AGENTIC_TEST_URL =
  "https://github.com/Sys64k/ai-swarm-orchestrator/blob/main/docs/local-model-experiment.md";
export const AGENTIC_TEST_LEVELS = 5;
export const AGENTIC_TEST_VRAM_GB = 16;
export const AGENTIC_TEST_GPU = `RTX 5060 Ti ${AGENTIC_TEST_VRAM_GB} GB`;
export const AGENTIC_TEST_CAVEAT = `One small coding test: ${AGENTIC_TEST_LEVELS} tasks, one run each. It's a single data point, not a ranking of the models.`;
// Checked with `ollama ps` on the test machine: with the desktop holding about 2 GB, none
// of the five fit entirely in VRAM at the test's context.
export const AGENTIC_TEST_CPU_NOTE = `On the ${AGENTIC_TEST_VRAM_GB} GB test GPU every model ran partly on the CPU at the test's context; that makes a model slower, not worse.`;

export const AGENTIC_TEST_RESULTS: AgenticTestResult[] = [
  {
    ollamaTag: "qwen3-coder:30b",
    name: "qwen3-coder 30B",
    anchor: "qwen3-coder-30b",
    levelsPassed: 3,
    levelsPassedTestsFirst: 4,
    calculatorSlug: "qwen3-coder-30b-a3b",
  },
  {
    ollamaTag: "glm-4.7-flash",
    name: "glm-4.7-flash 30B",
    anchor: "glm-47-flash-30b",
    levelsPassed: 3,
    levelsPassedTestsFirst: 5,
    calculatorSlug: "glm-4-7-flash",
  },
  {
    ollamaTag: "gpt-oss:20b",
    name: "gpt-oss 20B",
    anchor: "gpt-oss-20b",
    levelsPassed: 3,
    levelsPassedTestsFirst: null,
    calculatorSlug: "gpt-oss-20b",
  },
  {
    ollamaTag: "devstral:24b",
    name: "devstral 24B",
    anchor: "devstral-24b",
    levelsPassed: 0,
    levelsPassedTestsFirst: null,
    calculatorSlug: "devstral-small-24b",
  },
  {
    ollamaTag: "qwen2.5-coder:14b",
    name: "qwen2.5-coder 14B",
    anchor: "qwen25-coder-14b",
    levelsPassed: 0,
    levelsPassedTestsFirst: null,
    calculatorSlug: "qwen2-5-coder-14b",
  },
];

export function agenticTestResultUrl(result: AgenticTestResult): string {
  return `${AGENTIC_TEST_URL}#${result.anchor}`;
}

export function formatAgenticTestScore(result: AgenticTestResult): string {
  const alone = `${result.levelsPassed} of ${AGENTIC_TEST_LEVELS}`;
  if (result.levelsPassedTestsFirst === null) return alone;
  return `${alone} alone, ${result.levelsPassedTestsFirst} of ${AGENTIC_TEST_LEVELS} with tests written first`;
}

export interface AgenticTestSummary {
  total: number;
  passedNone: number;
  passedSome: number;
  testsFirstRuns: number;      // models run with tests first on every level
  testsFirstImproved: number;  // of those, how many passed more levels than alone
}

export function summarizeAgenticResults(results: AgenticTestResult[]): AgenticTestSummary {
  const testsFirst = results.filter((r) => r.levelsPassedTestsFirst !== null);
  const passedNone = results.filter((r) => r.levelsPassed === 0).length;
  return {
    total: results.length,
    passedNone,
    passedSome: results.length - passedNone,
    testsFirstRuns: testsFirst.length,
    testsFirstImproved: testsFirst.filter((r) => (r.levelsPassedTestsFirst ?? 0) > r.levelsPassed).length,
  };
}

// "all 2", "1 of the 2": how many tests-first runs passed more levels than alone.
export function describeTestsFirstGain(summary: AgenticTestSummary): string {
  const { testsFirstImproved: improved, testsFirstRuns: runs } = summary;
  if (improved === runs) return runs === 2 ? "both" : `all ${runs}`;
  return `${improved} of the ${runs}`;
}

export function getAgenticTestResult(calculatorSlug: string): AgenticTestResult | undefined {
  return AGENTIC_TEST_RESULTS.find((r) => r.calculatorSlug === calculatorSlug);
}
