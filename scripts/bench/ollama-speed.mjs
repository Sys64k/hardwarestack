#!/usr/bin/env node
// Measures local LLM speed through an Ollama server's HTTP API.
// Standalone: not imported by the app. Results feed lib/measured-llm-speed.ts.
//
// Usage:
//   node scripts/bench/ollama-speed.mjs --host http://avalon:11434 \
//     --models qwen3-coder:30b,gpt-oss:20b --contexts 8192,32768 --runs 3 --out results.json
//
// Per model and context: one warm-up request (loads the model, not timed), then `runs`
// timed requests. Each request starts with a different line, so Ollama's prompt cache
// can't skip prompt processing. The prompt is this repo's own source code plus a
// coding question, to look like a coding-agent turn. Its token count depends on the
// model's tokenizer (recorded per result as promptTokens), and it changes when those
// source files change, so the report records a hash of the prompt to compare runs.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    host: { type: "string", default: "http://localhost:11434" },
    models: { type: "string" },
    contexts: { type: "string", default: "8192,32768,65536" },
    runs: { type: "string", default: "3" },
    predict: { type: "string", default: "256" },
    out: { type: "string", default: "ollama-speed.json" },
    gpu: { type: "string", default: "" },
    cpu: { type: "string", default: "" },
    ram: { type: "string", default: "" },
    note: { type: "string", default: "" },
  },
});

if (!args.models) {
  console.error("--models is required (comma-separated Ollama tags)");
  process.exit(1);
}

const models = args.models.split(",").map((s) => s.trim()).filter(Boolean);
const contexts = args.contexts.split(",").map(Number);
const runs = Number(args.runs);
const predict = Number(args.predict);
if (contexts.some((c) => !Number.isInteger(c) || c <= 0) || !(runs > 0) || !(predict > 0)) {
  console.error("--contexts, --runs and --predict must be positive integers");
  process.exit(1);
}

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE = ["lib/upgrade.ts", "lib/bottleneck.ts"]
  .map((f) => `// ${f}\n${readFileSync(join(repo, f), "utf8")}`)
  .join("\n\n");
const QUESTION =
  "Review the TypeScript modules above. List the three most likely bugs or edge cases, " +
  "each with the function name and a one-paragraph explanation.";

const prompt = (label) => `${label}\n\n${SOURCE}\n\n${QUESTION}`;

async function api(path, body) {
  const res = await fetch(`${args.host}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

function generate(model, numCtx, label, numPredict) {
  return api("/api/generate", {
    model,
    prompt: prompt(label),
    stream: false,
    keep_alive: "10m",
    options: { num_ctx: numCtx, num_predict: numPredict, temperature: 0, seed: 42 },
  });
}

const perSecond = (count, ns) => (ns > 0 ? count / (ns / 1e9) : null);
const median = (xs) => {
  const s = xs.filter((x) => x !== null).sort((a, b) => a - b);
  if (s.length === 0) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round1 = (x) => (x === null ? null : Math.round(x * 10) / 10);

const version = (await api("/api/version")).version;
const results = [];

for (const model of models) {
  for (const numCtx of contexts) {
    const tag = `${model} @ ${numCtx}`;
    try {
      process.stderr.write(`${tag}: loading… `);
      const warm = await generate(model, numCtx, "Warm-up.", 16);
      const ps = await api("/api/ps");
      const loaded = ps.models.find((m) => m.name === model || m.model === model);

      const timed = [];
      for (let i = 1; i <= runs; i++) {
        const r = await generate(model, numCtx, `Request ${i} of ${runs}.`, predict);
        timed.push({
          promptTokens: r.prompt_eval_count,
          promptTokensPerSecond: perSecond(r.prompt_eval_count, r.prompt_eval_duration),
          generatedTokens: r.eval_count,
          generationTokensPerSecond: perSecond(r.eval_count, r.eval_duration),
        });
        process.stderr.write(`${i} `);
      }

      const sizeBytes = loaded?.size ?? null;
      const vramBytes = loaded?.size_vram ?? null;
      results.push({
        model,
        numCtx,
        loadSeconds: round1(warm.load_duration / 1e9),
        memoryGb: sizeBytes === null ? null : round1(sizeBytes / 1e9),
        gpuShare: sizeBytes && vramBytes !== null ? Math.round((vramBytes / sizeBytes) * 100) / 100 : null,
        promptTokens: timed[0].promptTokens,
        promptTokensPerSecond: round1(median(timed.map((t) => t.promptTokensPerSecond))),
        generationTokensPerSecond: round1(median(timed.map((t) => t.generationTokensPerSecond))),
        runs: timed,
      });
      process.stderr.write("done\n");
    } catch (err) {
      process.stderr.write(`failed: ${err.message}\n`);
      results.push({ model, numCtx, error: String(err.message) });
    } finally {
      // Unload so the next model or context starts from an empty GPU.
      await api("/api/generate", { model, keep_alive: 0 }).catch(() => {});
    }
  }
}

const report = {
  measuredAt: new Date().toISOString(),
  ollamaVersion: version,
  machine: { gpu: args.gpu, cpu: args.cpu, ram: args.ram, note: args.note },
  settings: {
    runs,
    numPredict: predict,
    temperature: 0,
    promptChars: prompt("").length,
    promptSha256: createHash("sha256").update(prompt("")).digest("hex").slice(0, 16),
  },
  results,
};
writeFileSync(args.out, JSON.stringify(report, null, 2) + "\n");
const failed = results.filter((r) => r.error).length;
console.log(`wrote ${args.out}: ${results.length} results, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
