import type { Selection, SetConstraints, ThresholdModel } from "./types.js";

function validateScores(scores: Record<string, number>): void {
  for (const [label, score] of Object.entries(scores)) if (!Number.isFinite(score) || score < 0 || score > 1) throw new Error(`score for ${label} must be between 0 and 1`);
}

export function selectLabels(scores: Record<string, number>, model: ThresholdModel, constraints: SetConstraints = {}): Selection {
  validateScores(scores);
  const rejected: Selection["rejected"] = {};
  const selected = new Set<string>();
  for (const [label, score] of Object.entries(scores)) {
    if (score >= (model.thresholds[label] ?? model.fallbackThreshold)) selected.add(label);
    else rejected[label] = "below-threshold";
  }
  for (const group of constraints.exclusiveGroups ?? []) {
    const active = group.filter((label) => selected.has(label)).sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0) || a.localeCompare(b));
    for (const label of active.slice(1)) { selected.delete(label); rejected[label] = "exclusive"; }
  }
  const maximum = constraints.maxLabels;
  if (maximum !== undefined) {
    if (!Number.isInteger(maximum) || maximum < 0) throw new Error("maxLabels must be a non-negative integer");
    const ranked = [...selected].sort((a, b) => (scores[b] ?? 1) - (scores[a] ?? 1) || a.localeCompare(b));
    for (const label of ranked.slice(maximum)) { selected.delete(label); rejected[label] = "max-labels"; }
  }
  const minimum = constraints.minLabels ?? 0;
  if (!Number.isInteger(minimum) || minimum < 0) throw new Error("minLabels must be a non-negative integer");
  if (selected.size < minimum) {
    const candidates = Object.keys(scores).filter((label) => !selected.has(label)).sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0) || a.localeCompare(b));
    for (const label of candidates) {
      if (selected.size >= minimum || (maximum !== undefined && selected.size >= maximum)) break;
      selected.add(label);
      delete rejected[label];
    }
  }
  const appliedParents = new Set<string>();
  for (const initial of [...selected]) {
    let current = initial;
    const seen = new Set<string>();
    while (constraints.parents?.[current]) {
      if (seen.has(current)) throw new Error("parent hierarchy contains a cycle");
      seen.add(current);
      current = constraints.parents[current] as string;
      if (!selected.has(current)) { selected.add(current); appliedParents.add(current); }
    }
  }
  return { labels: [...selected].sort((a, b) => (scores[b] ?? 1) - (scores[a] ?? 1) || a.localeCompare(b)), rejected, appliedParents: [...appliedParents].sort() };
}
