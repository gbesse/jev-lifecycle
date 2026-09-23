import type { DecisionDiff, DecisionEnvelope } from "./types.js";

export function compareDecisions(primary: DecisionEnvelope, shadow: DecisionEnvelope, numericTolerance = 0.05): DecisionDiff[] {
  if (!Number.isFinite(numericTolerance) || numericTolerance < 0) throw new Error("numericTolerance must be non-negative");
  const keys = new Set([...Object.keys(primary.decisions), ...Object.keys(shadow.decisions)]);
  return [...keys].sort().map((key) => {
    const left = primary.decisions[key];
    const right = shadow.decisions[key];
    const leftConfidence = primary.confidence?.[key];
    const rightConfidence = shadow.confidence?.[key];
    const bothNumeric = typeof left === "number" && typeof right === "number";
    const valueDelta = bothNumeric ? Math.abs(left - right) : undefined;
    const diff: DecisionDiff = { key, agrees: left !== undefined && right !== undefined && (bothNumeric ? (valueDelta as number) <= numericTolerance : left === right) };
    if (left !== undefined) diff.primary = left;
    if (right !== undefined) diff.shadow = right;
    if (leftConfidence !== undefined && rightConfidence !== undefined) diff.confidenceDelta = Math.abs(leftConfidence - rightConfidence);
    if (valueDelta !== undefined) diff.valueDelta = valueDelta;
    return diff;
  });
}

export function agreementRate(diffs: DecisionDiff[]): number {
  return diffs.length === 0 ? 1 : diffs.filter((diff) => diff.agrees).length / diffs.length;
}
