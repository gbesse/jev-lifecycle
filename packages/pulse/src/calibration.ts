import type { DecisionEvent, ThresholdOptions, ThresholdPoint, ThresholdRecommendation } from "./types.js";

function unit(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function confidence(event: DecisionEvent): number | undefined {
  if (unit(event.confidence)) return event.confidence;
  const value = event.probabilities?.[String(event.prediction)];
  return unit(value) ? value : undefined;
}

function wilsonLower(hits: number, total: number): number | null {
  if (!total) return null;
  const z = 1.959963984540054;
  const proportion = hits / total;
  const denominator = 1 + z ** 2 / total;
  const centre = proportion + z ** 2 / (2 * total);
  const adjustment = z * Math.sqrt((proportion * (1 - proportion) + z ** 2 / (4 * total)) / total);
  return Math.max(0, (centre - adjustment) / denominator);
}

function optionsWithDefaults(options: ThresholdOptions): Required<Omit<ThresholdOptions, "costs">> & { costs: Required<NonNullable<ThresholdOptions["costs"]>> } {
  const result = {
    targetAccuracy: options.targetAccuracy ?? 0.95,
    minCoverage: options.minCoverage ?? 0,
    step: options.step ?? 0.01,
    quantization: options.quantization ?? 0.01,
    quantizationMode: options.quantizationMode ?? "conservative" as const,
    confidenceMode: options.confidenceMode ?? "wilson" as const,
    costs: { accepted: options.costs?.accepted ?? 0, review: options.costs?.review ?? 1, falseAccept: options.costs?.falseAccept ?? 10 },
  };
  for (const [name, value] of Object.entries({ targetAccuracy: result.targetAccuracy, minCoverage: result.minCoverage, step: result.step, quantization: result.quantization })) {
    if (!unit(value) || (name === "step" && value === 0)) throw new Error(`${name} must be ${name === "step" ? "greater than zero and " : ""}between 0 and 1`);
  }
  if (!Object.values(result.costs).every((value) => Number.isFinite(value) && value >= 0)) throw new Error("costs must be finite non-negative numbers");
  return result;
}

export function simulateThresholds(events: DecisionEvent[], options: ThresholdOptions = {}): ThresholdPoint[] {
  const config = optionsWithDefaults(options);
  for (const event of events) {
    if (event.confidence !== undefined && !unit(event.confidence)) throw new Error(`event ${event.id} has invalid confidence`);
    const selected = event.probabilities?.[String(event.prediction)];
    if (selected !== undefined && !unit(selected)) throw new Error(`event ${event.id} has invalid selected probability`);
  }
  const eligible = events.filter((event) => event.label !== undefined && confidence(event) !== undefined && (event.status ?? "ok") !== "error");
  const points: ThresholdPoint[] = [];
  const count = Math.ceil(1 / config.step);
  for (let index = 0; index <= count; index += 1) {
    const threshold = Math.min(1, Number((index * config.step).toFixed(12)));
    const accepted = eligible.filter((event) => {
      const value = confidence(event) as number;
      const comparable = config.quantizationMode === "conservative" ? Math.max(0, value - config.quantization / 2) : value;
      return comparable >= threshold;
    });
    const hits = accepted.filter((event) => event.prediction === event.label).length;
    const errors = accepted.length - hits;
    const reviewed = eligible.length - accepted.length;
    points.push({
      threshold,
      accepted: accepted.length,
      reviewed,
      labeledAccepted: accepted.length,
      errors,
      coverage: eligible.length ? accepted.length / eligible.length : 0,
      selectiveAccuracy: accepted.length ? hits / accepted.length : null,
      accuracyLowerBound95: wilsonLower(hits, accepted.length),
      expectedCost: accepted.length * config.costs.accepted + reviewed * config.costs.review + errors * config.costs.falseAccept,
    });
  }
  return points;
}

export function recommendThreshold(events: DecisionEvent[], options: ThresholdOptions = {}): ThresholdRecommendation {
  const config = optionsWithDefaults(options);
  const frontier = simulateThresholds(events, options);
  const labeledEvents = events.filter((event) => event.label !== undefined && confidence(event) !== undefined && (event.status ?? "ok") !== "error").length;
  const feasible = frontier.filter((point) => {
    const accuracy = config.confidenceMode === "wilson" ? point.accuracyLowerBound95 : point.selectiveAccuracy;
    return point.accepted > 0 && point.coverage >= config.minCoverage && accuracy !== null && accuracy >= config.targetAccuracy;
  }).sort((a, b) => b.coverage - a.coverage || a.expectedCost - b.expectedCost || a.threshold - b.threshold);
  return {
    schemaVersion: 1,
    labeledEvents,
    targetAccuracy: config.targetAccuracy,
    minCoverage: config.minCoverage,
    quantization: config.quantization,
    quantizationMode: config.quantizationMode,
    confidenceMode: config.confidenceMode,
    selected: feasible[0] ?? null,
    reason: !labeledEvents ? "no-labeled-confidence" : feasible.length ? "recommended" : "no-feasible-threshold",
    frontier,
  };
}
