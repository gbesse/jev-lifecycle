import assert from "node:assert/strict";
import test from "node:test";
import { attachLabels, buildReport, comparePopulations, recommendThreshold, simulateThresholds, type DecisionEvent } from "../src/index.js";

const base = (id: string, prediction: string, confidence: number, label?: string): DecisionEvent => ({ schemaVersion: 1, id, timestamp: "2026-09-23T00:00:00Z", contract: "route", contractVersion: "1", model: "jev-1.13.0", question: "team", prediction, probabilities: { a: prediction === "a" ? confidence : 1 - confidence, b: prediction === "b" ? confidence : 1 - confidence }, confidence, latencyMs: 100, ...(label ? { label } : {}) });

test("attaches delayed labels without mutating unmatched events", () => {
  const result = attachLabels([base("1", "a", 0.9), base("2", "b", 0.8)], [{ id: "2", label: "b" }]);
  assert.equal(result[0]?.label, undefined);
  assert.equal(result[1]?.label, "b");
});

test("computes calibration, coverage and selective accuracy", () => {
  const report = buildReport([base("1", "a", 0.9, "a"), base("2", "b", 0.85, "a"), base("3", "a", 0.4, "a")], { threshold: 0.8, bins: 5 });
  assert.equal(report.accuracy, 2 / 3);
  assert.equal(report.coverage, 2 / 3);
  assert.equal(report.selectiveAccuracy, 0.5);
  assert.equal(report.highConfidenceErrors, 1);
  assert.ok(report.ece !== null);
});

test("does not invent accuracy without labels", () => {
  const report = buildReport([base("1", "a", 0.7)]);
  assert.equal(report.accuracy, null);
  assert.equal(report.brier, null);
});

test("reports category population drift", () => {
  const drift = comparePopulations([base("1", "a", 0.9), base("2", "a", 0.8)], [base("3", "b", 0.7), base("4", "b", 0.6)]);
  assert.equal(drift.totalVariation, 1);
  assert.ok((drift.confidenceShift ?? 0) < 0);
});

test("groups results by model and slice", () => {
  const event = { ...base("1", "a", 0.9, "a"), slices: { locale: "fr" } };
  const report = buildReport([event]);
  assert.equal(report.byModel["jev-1.13.0"]?.count, 1);
  assert.equal(report.bySlice.locale?.fr?.accuracy, 1);
});

test("rejects malformed telemetry instead of producing a report", () => {
  assert.throws(() => buildReport([{ ...base("1", "a", 0.9), probabilities: { a: 0.9, b: 0.9 } }]), /do not sum/);
});

test("recommends the highest-coverage threshold that meets observed accuracy", () => {
  const events = [base("1", "a", 0.99, "a"), base("2", "a", 0.91, "a"), base("3", "a", 0.81, "b"), base("4", "a", 0.4, "b")];
  const result = recommendThreshold(events, { targetAccuracy: 1, confidenceMode: "observed", quantizationMode: "raw", step: 0.1 });
  assert.equal(result.reason, "recommended");
  assert.equal(result.selected?.threshold, 0.9);
  assert.equal(result.selected?.coverage, 0.5);
});

test("uses a conservative half-step for rounded probabilities", () => {
  const events = [base("1", "a", 0.8, "a")];
  const raw = simulateThresholds(events, { step: 0.8, quantization: 0.01, quantizationMode: "raw" });
  const conservative = simulateThresholds(events, { step: 0.8, quantization: 0.01, quantizationMode: "conservative" });
  assert.equal(raw.find((point) => point.threshold === 0.8)?.accepted, 1);
  assert.equal(conservative.find((point) => point.threshold === 0.8)?.accepted, 0);
});

test("reports when no statistically supported threshold is feasible", () => {
  const result = recommendThreshold([base("1", "a", 0.99, "a")], { targetAccuracy: 0.95, confidenceMode: "wilson" });
  assert.equal(result.selected, null);
  assert.equal(result.reason, "no-feasible-threshold");
});

test("accounts for review and false-accept costs", () => {
  const points = simulateThresholds([base("1", "a", 0.9, "b"), base("2", "a", 0.2, "a")], { step: 1, quantizationMode: "raw", costs: { review: 2, falseAccept: 10 } });
  assert.equal(points[0]?.expectedCost, 10);
  assert.equal(points[1]?.expectedCost, 4);
});
