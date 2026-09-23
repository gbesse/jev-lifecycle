import type { CalibrationBin, DecisionEvent, PulseReport } from "./types.js";

function finiteUnit(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function correct(event: DecisionEvent): boolean {
  return event.label !== undefined && event.prediction === event.label;
}

function validateEvents(events: DecisionEvent[]): void {
  for (const event of events) {
    if (event.schemaVersion !== 1 || !event.id || !event.contract || !event.model || !event.question) throw new Error("event is missing required identity fields");
    if (Number.isNaN(Date.parse(event.timestamp))) throw new Error(`event ${event.id} has an invalid timestamp`);
    if (!Number.isFinite(event.latencyMs) || event.latencyMs < 0) throw new Error(`event ${event.id} has invalid latency`);
    if (event.confidence !== undefined && !finiteUnit(event.confidence)) throw new Error(`event ${event.id} has invalid confidence`);
    if (event.probabilities) {
      const values = Object.values(event.probabilities);
      if (!values.length || values.some((value) => !finiteUnit(value))) throw new Error(`event ${event.id} has invalid probabilities`);
      if (Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 0.001) throw new Error(`event ${event.id} probabilities do not sum to one`);
    }
  }
}

function eventConfidence(event: DecisionEvent): number | undefined {
  if (finiteUnit(event.confidence)) return event.confidence;
  if (event.probabilities) {
    const key = String(event.prediction);
    const value = event.probabilities[key];
    if (finiteUnit(value)) return value;
  }
  return undefined;
}

function brier(event: DecisionEvent): number | undefined {
  if (event.label === undefined) return undefined;
  if (event.probabilities) {
    const keys = new Set([...Object.keys(event.probabilities), String(event.label)]);
    const values = [...keys].map((key) => {
      const probability = event.probabilities?.[key] ?? 0;
      if (!finiteUnit(probability)) throw new Error(`invalid probability in event ${event.id}`);
      const target = key === String(event.label) ? 1 : 0;
      return (probability - target) ** 2;
    });
    return values.reduce((sum, value) => sum + value, 0);
  }
  if (typeof event.prediction === "number" && typeof event.label === "boolean" && finiteUnit(event.prediction)) {
    return (event.prediction - (event.label ? 1 : 0)) ** 2;
  }
  return undefined;
}

function percentile(values: number[], quantile: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1))] ?? null;
}

function calibration(events: DecisionEvent[], bins: number): CalibrationBin[] {
  const groups = Array.from({ length: bins }, () => [] as Array<{ confidence: number; hit: number }>);
  for (const event of events) {
    if (event.label === undefined) continue;
    const confidence = eventConfidence(event);
    if (confidence === undefined) continue;
    const index = Math.min(bins - 1, Math.floor(confidence * bins));
    groups[index]?.push({ confidence, hit: correct(event) ? 1 : 0 });
  }
  return groups.map((group, index) => {
    const meanConfidence = group.length ? group.reduce((sum, item) => sum + item.confidence, 0) / group.length : 0;
    const accuracy = group.length ? group.reduce((sum, item) => sum + item.hit, 0) / group.length : 0;
    return { lower: index / bins, upper: (index + 1) / bins, count: group.length, meanConfidence, accuracy, gap: Math.abs(meanConfidence - accuracy) };
  });
}

function grouped(events: DecisionEvent[], key: (event: DecisionEvent) => string): Record<string, { count: number; accuracy: number | null; meanConfidence: number | null }> {
  const groups = new Map<string, DecisionEvent[]>();
  for (const event of events) groups.set(key(event), [...(groups.get(key(event)) ?? []), event]);
  return Object.fromEntries([...groups].sort(([a], [b]) => a.localeCompare(b)).map(([name, items]) => {
    const labeled = items.filter((item) => item.label !== undefined);
    const confidences = items.map(eventConfidence).filter((value): value is number => value !== undefined);
    return [name, { count: items.length, accuracy: labeled.length ? labeled.filter(correct).length / labeled.length : null, meanConfidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : null }];
  }));
}

export function buildReport(events: DecisionEvent[], options: { threshold?: number; bins?: number } = {}): PulseReport {
  validateEvents(events);
  const threshold = options.threshold ?? 0.8;
  const bins = options.bins ?? 10;
  if (!finiteUnit(threshold)) throw new Error("threshold must be between 0 and 1");
  if (!Number.isInteger(bins) || bins < 2 || bins > 100) throw new Error("bins must be an integer between 2 and 100");
  const successful = events.filter((event) => (event.status ?? "ok") !== "error");
  const labeled = successful.filter((event) => event.label !== undefined);
  const accepted = successful.filter((event) => (eventConfidence(event) ?? 0) >= threshold);
  const acceptedLabeled = accepted.filter((event) => event.label !== undefined);
  const briers = labeled.map(brier).filter((value): value is number => value !== undefined);
  const binsReport = calibration(successful, bins);
  const withConfidence = binsReport.reduce((sum, bin) => sum + bin.count, 0);
  const ece = withConfidence ? binsReport.reduce((sum, bin) => sum + bin.gap * bin.count, 0) / withConfidence : null;
  const bySlice: PulseReport["bySlice"] = {};
  const sliceNames = new Set(successful.flatMap((event) => Object.keys(event.slices ?? {})));
  for (const slice of sliceNames) {
    const data = grouped(successful.filter((event) => event.slices?.[slice] !== undefined), (event) => event.slices?.[slice] ?? "unknown");
    bySlice[slice] = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, { count: value.count, accuracy: value.accuracy }]));
  }
  const latencies = successful.map((event) => event.latencyMs).filter((value) => Number.isFinite(value) && value >= 0);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    total: events.length,
    successful: successful.length,
    labeled: labeled.length,
    errors: events.length - successful.length,
    accuracy: labeled.length ? labeled.filter(correct).length / labeled.length : null,
    brier: briers.length ? briers.reduce((sum, value) => sum + value, 0) / briers.length : null,
    ece,
    highConfidenceErrors: acceptedLabeled.filter((event) => !correct(event)).length,
    coverage: successful.length ? accepted.length / successful.length : 0,
    selectiveAccuracy: acceptedLabeled.length ? acceptedLabeled.filter(correct).length / acceptedLabeled.length : null,
    latencyMs: { p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95), max: latencies.length ? Math.max(...latencies) : null },
    inputTokens: successful.reduce((sum, event) => sum + (event.inputTokens ?? 0), 0),
    outputTokens: successful.reduce((sum, event) => sum + (event.outputTokens ?? 0), 0),
    calibration: binsReport,
    byModel: grouped(successful, (event) => event.model),
    bySlice,
  };
}
