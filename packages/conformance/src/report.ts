import { inspectOutput, outputKey } from "./protocol.js";
import type { ConformanceCase, ConformanceReport, Observation, ProviderReport } from "./types.js";

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
}

function isCorrect(testCase: ConformanceCase, observation: Observation): boolean | undefined {
  if (!testCase.expected || !observation.output) return undefined;
  const expected = testCase.expected;
  if (expected.kind === "score") return observation.output.score !== undefined && Math.abs(observation.output.score - expected.value) <= (expected.tolerance ?? 0.01);
  return observation.output.selected === expected.value;
}

function providerReport(provider: string, cases: Map<string, ConformanceCase>, observations: Observation[]): ProviderReport {
  const issues: Record<string, number> = {};
  let protocolValid = 0;
  let correct = 0;
  let labeled = 0;
  let brierTotal = 0;
  let brierCount = 0;
  for (const observation of observations) {
    if (!observation.output || observation.error) continue;
    const found = inspectOutput(observation.output);
    if (found.length === 0) protocolValid += 1;
    for (const issue of found) issues[issue.code] = (issues[issue.code] ?? 0) + 1;
    const testCase = cases.get(observation.caseId);
    if (!testCase) { issues.UNKNOWN_CASE = (issues.UNKNOWN_CASE ?? 0) + 1; continue; }
    const result = isCorrect(testCase, observation);
    if (result !== undefined) { labeled += 1; if (result) correct += 1; }
    if (testCase.expected?.kind === "boolean" && observation.output.probabilities) {
      const probability = observation.output.probabilities.true ?? observation.output.probabilities.yes;
      if (probability !== undefined) { brierTotal += (probability - Number(testCase.expected.value)) ** 2; brierCount += 1; }
    }
  }

  const grouped = new Map<string, string[]>();
  for (const observation of observations.filter((entry) => entry.output)) {
    const values = grouped.get(observation.caseId) ?? [];
    values.push(outputKey(observation.output as NonNullable<Observation["output"]>));
    grouped.set(observation.caseId, values);
  }
  const repeated = [...grouped.values()].filter((values) => values.length > 1);
  const deterministicRate = repeated.length === 0 ? undefined : repeated.filter((values) => new Set(values).size === 1).length / repeated.length;
  const latencies = observations.map((entry) => entry.latencyMs);
  return {
    provider,
    cases: new Set(observations.map((entry) => entry.caseId)).size,
    successful: observations.filter((entry) => entry.output && !entry.error).length,
    protocolValid,
    correct,
    ...(labeled > 0 ? { accuracy: correct / labeled } : {}),
    ...(brierCount > 0 ? { brierScore: brierTotal / brierCount } : {}),
    ...(deterministicRate !== undefined ? { deterministicRate } : {}),
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    totalCost: observations.reduce((total, entry) => total + (entry.cost ?? 0), 0),
    issues
  };
}

export function createReport(testCases: ConformanceCase[], observations: Observation[], generatedAt = new Date().toISOString()): ConformanceReport {
  const byId = new Map(testCases.map((testCase) => [testCase.id, testCase]));
  const providers = [...new Set(observations.map((entry) => entry.provider))].sort();
  return { generatedAt, providers: providers.map((provider) => providerReport(provider, byId, observations.filter((entry) => entry.provider === provider))) };
}
