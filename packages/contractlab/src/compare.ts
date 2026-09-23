import type { ComparableAnswer, DecisionResponse } from "./types.js";

export type AnswerDiff = {
  question: string;
  changed: boolean;
  decisionChanged: boolean;
  maxProbabilityDelta: number;
  confidenceDelta: number;
  issues: string[];
};

function decision(answer: ComparableAnswer): string | number | undefined {
  return answer.type === "noul" ? answer.noul : answer.type === "choice" ? answer.choice : answer.score;
}

function validDistribution(answer: ComparableAnswer): string[] {
  if (!answer.probabilities) return [];
  const values = Object.values(answer.probabilities);
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) return ["probability-out-of-range"];
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.abs(total - 1) > 0.001 ? ["probabilities-do-not-sum-to-one"] : [];
}

export function compareResponses(baseline: DecisionResponse, candidate: DecisionResponse, tolerance = 0.05): AnswerDiff[] {
  const ids = new Set([...Object.keys(baseline.answers), ...Object.keys(candidate.answers)]);
  return [...ids].sort().map((question) => {
    const before = baseline.answers[question];
    const after = candidate.answers[question];
    if (!before || !after) return { question, changed: true, decisionChanged: true, maxProbabilityDelta: 1, confidenceDelta: 1, issues: [before ? "answer-removed" : "answer-added"] };
    const keys = new Set([...Object.keys(before.probabilities ?? {}), ...Object.keys(after.probabilities ?? {})]);
    const maximum = Math.max(0, ...[...keys].map((key) => Math.abs((before.probabilities?.[key] ?? 0) - (after.probabilities?.[key] ?? 0))));
    const confidenceDelta = Math.abs((before.confidence ?? 0) - (after.confidence ?? 0));
    const decisionChanged = decision(before) !== decision(after);
    const issues = [...validDistribution(before), ...validDistribution(after)];
    return { question, changed: decisionChanged || maximum > tolerance || confidenceDelta > tolerance || issues.length > 0, decisionChanged, maxProbabilityDelta: maximum, confidenceDelta, issues };
  });
}
