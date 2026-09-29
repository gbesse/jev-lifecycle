import type { DecisionOutput, ProtocolIssue } from "./types.js";

export function inspectOutput(output: DecisionOutput): ProtocolIssue[] {
  const issues: ProtocolIssue[] = [];
  if (output.selected === undefined && output.score === undefined) issues.push({ code: "MISSING_DECISION", message: "Output must include selected or score." });
  if (output.score !== undefined && !Number.isFinite(output.score)) issues.push({ code: "NON_FINITE_SCORE", message: "Score must be finite." });
  if (output.probabilities) {
    const values = Object.values(output.probabilities);
    if (values.length === 0) issues.push({ code: "EMPTY_PROBABILITIES", message: "Probability map cannot be empty." });
    if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) issues.push({ code: "INVALID_PROBABILITY", message: "Probabilities must be finite values in [0, 1]." });
    const sum = values.reduce((total, value) => total + value, 0);
    if (Math.abs(sum - 1) > 0.02) issues.push({ code: "PROBABILITY_SUM", message: `Probabilities sum to ${sum.toFixed(4)}, expected approximately 1.` });
  }
  return issues;
}

export function outputKey(output: DecisionOutput): string {
  if (output.selected !== undefined) return String(output.selected);
  if (output.score !== undefined) return String(output.score);
  return "<missing>";
}
