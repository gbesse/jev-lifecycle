import assert from "node:assert/strict";
import test from "node:test";
import { attachLabels, buildReport, comparePopulations, type DecisionEvent } from "../src/index.js";

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
