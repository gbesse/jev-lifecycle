import type { FitOptions, LabelFit, ThresholdModel, TrainingSample } from "./types.js";

function validateScore(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`score for ${label} must be between 0 and 1`);
}

function metrics(samples: TrainingSample[], label: string, threshold: number, beta: number): Omit<LabelFit, "threshold" | "support"> {
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  for (const sample of samples) {
    const predicted = (sample.scores[label] ?? 0) >= threshold;
    const actual = sample.labels.includes(label);
    if (predicted && actual) truePositive += 1;
    else if (predicted) falsePositive += 1;
    else if (actual) falseNegative += 1;
  }
  const precision = truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : 0;
  const recall = truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : 0;
  const betaSquared = beta ** 2;
  const fBeta = precision || recall ? (1 + betaSquared) * precision * recall / (betaSquared * precision + recall) : 0;
  return { precision, recall, fBeta };
}

export function fitThresholds(samples: TrainingSample[], options: FitOptions = {}): ThresholdModel {
  if (!samples.length) throw new Error("at least one training sample is required");
  const beta = options.beta ?? 1;
  const minimumSupport = options.minimumSupport ?? 2;
  const fallbackThreshold = options.fallbackThreshold ?? 0.5;
  if (!Number.isFinite(beta) || beta <= 0) throw new Error("beta must be positive");
  if (!Number.isInteger(minimumSupport) || minimumSupport < 1) throw new Error("minimumSupport must be a positive integer");
  validateScore(fallbackThreshold, "fallbackThreshold");
  const labelSet = new Set<string>();
  for (const sample of samples) {
    for (const [label, score] of Object.entries(sample.scores)) { labelSet.add(label); validateScore(score, label); }
    for (const label of sample.labels) labelSet.add(label);
  }
  const labels: Record<string, LabelFit> = {};
  const thresholds: Record<string, number> = {};
  for (const label of [...labelSet].sort()) {
    const support = samples.filter((sample) => sample.labels.includes(label)).length;
    if (support < minimumSupport) {
      const result = metrics(samples, label, fallbackThreshold, beta);
      labels[label] = { threshold: fallbackThreshold, support, ...result };
      thresholds[label] = fallbackThreshold;
      continue;
    }
    const candidates = new Set([0, 1, fallbackThreshold, ...samples.map((sample) => sample.scores[label] ?? 0)]);
    let best: LabelFit = { threshold: fallbackThreshold, support, ...metrics(samples, label, fallbackThreshold, beta) };
    for (const threshold of [...candidates].sort((a, b) => a - b)) {
      const result: LabelFit = { threshold, support, ...metrics(samples, label, threshold, beta) };
      if (result.fBeta > best.fBeta || (result.fBeta === best.fBeta && result.precision > best.precision) || (result.fBeta === best.fBeta && result.precision === best.precision && threshold > best.threshold)) best = result;
    }
    labels[label] = best;
    thresholds[label] = best.threshold;
  }
  return { schemaVersion: 1, fittedAt: new Date().toISOString(), thresholds, labels, fallbackThreshold };
}
