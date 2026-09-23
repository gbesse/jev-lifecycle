import type { DecisionEvent } from "./types.js";

export type DriftReport = {
  totalVariation: number;
  confidenceShift: number | null;
  baselineCount: number;
  candidateCount: number;
  categories: Record<string, { baseline: number; candidate: number; delta: number }>;
};

function distribution(events: DecisionEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) counts.set(String(event.prediction), (counts.get(String(event.prediction)) ?? 0) + 1);
  return new Map([...counts].map(([key, count]) => [key, events.length ? count / events.length : 0]));
}

function meanConfidence(events: DecisionEvent[]): number | null {
  const values = events.map((event) => event.confidence).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function comparePopulations(baseline: DecisionEvent[], candidate: DecisionEvent[]): DriftReport {
  const left = distribution(baseline);
  const right = distribution(candidate);
  const keys = new Set([...left.keys(), ...right.keys()]);
  const categories = Object.fromEntries([...keys].sort().map((key) => {
    const a = left.get(key) ?? 0;
    const b = right.get(key) ?? 0;
    return [key, { baseline: a, candidate: b, delta: b - a }];
  }));
  const totalVariation = 0.5 * Object.values(categories).reduce((sum, item) => sum + Math.abs(item.delta), 0);
  const a = meanConfidence(baseline);
  const b = meanConfidence(candidate);
  return { totalVariation, confidenceShift: a === null || b === null ? null : b - a, baselineCount: baseline.length, candidateCount: candidate.length, categories };
}
