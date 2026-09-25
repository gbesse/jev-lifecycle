#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { compareResponses } from "./compare.js";
import { fingerprint } from "./canonical.js";
import { lintContract } from "./lint.js";
import { generateMutations } from "./mutate.js";
import { analyzeStability } from "./stability.js";
import type { DecisionContract, DecisionResponse, Json, StabilityObservation } from "./types.js";

async function json<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;
  if (command === "lint" && args[0]) {
    const contract = await json<DecisionContract>(args[0]);
    const issues = lintContract(contract);
    console.log(JSON.stringify({ fingerprint: fingerprint(contract as unknown as Json), issues }, null, 2));
    if (issues.some((issue) => issue.severity === "error")) process.exitCode = 1;
    return;
  }
  if (command === "mutate" && args[0]) {
    console.log(JSON.stringify(generateMutations(await json<Json>(args[0])), null, 2));
    return;
  }
  if (command === "compare" && args[0] && args[1]) {
    const diffs = compareResponses(await json<DecisionResponse>(args[0]), await json<DecisionResponse>(args[1]));
    console.log(JSON.stringify(diffs, null, 2));
    if (diffs.some((diff) => diff.changed)) process.exitCode = 2;
    return;
  }
  if (command === "stability" && args[0]) {
    const toleranceIndex = args.indexOf("--tolerance");
    const tolerance = toleranceIndex >= 0 ? Number(args[toleranceIndex + 1]) : undefined;
    const report = analyzeStability(await json<StabilityObservation[]>(args[0]), tolerance === undefined ? {} : { tolerance });
    console.log(JSON.stringify(report, null, 2));
    if (!report.stable) process.exitCode = 2;
    return;
  }
  console.error("Usage: jev-contract lint <contract.json> | mutate <state.json> | compare <baseline.json> <candidate.json> | stability <observations.json> [--tolerance 0.011]");
  process.exitCode = 1;
}

await main();
