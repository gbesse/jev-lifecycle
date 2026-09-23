import assert from "node:assert/strict";
import test from "node:test";
import { fitThresholds, selectLabels } from "../src/index.js";

const samples = [
  { scores: { fraud: 0.9, phishing: 0.2 }, labels: ["fraud"] },
  { scores: { fraud: 0.8, phishing: 0.7 }, labels: ["fraud", "phishing"] },
  { scores: { fraud: 0.3, phishing: 0.9 }, labels: ["phishing"] },
  { scores: { fraud: 0.1, phishing: 0.2 }, labels: [] },
];

test("fits deterministic per-label thresholds", () => {
  const model = fitThresholds(samples);
  assert.equal(model.thresholds.fraud, 0.8);
  assert.equal(model.thresholds.phishing, 0.7);
  assert.equal(model.labels.fraud?.precision, 1);
});

test("uses a fallback threshold for sparse labels", () => {
  const model = fitThresholds([{ scores: { rare: 0.9 }, labels: ["rare"] }, { scores: { rare: 0.2 }, labels: [] }], { minimumSupport: 2, fallbackThreshold: 0.6 });
  assert.equal(model.thresholds.rare, 0.6);
});

test("applies hierarchy and exclusive groups", () => {
  const model = fitThresholds(samples);
  const result = selectLabels({ fraud: 0.9, phishing: 0.8, security: 0.1 }, model, { parents: { fraud: "security" }, exclusiveGroups: [["fraud", "phishing"]] });
  assert.deepEqual(result.labels, ["fraud", "security"]);
  assert.equal(result.rejected.phishing, "exclusive");
});

test("enforces maximum and minimum cardinality", () => {
  const model = { schemaVersion: 1 as const, fittedAt: "now", fallbackThreshold: 0.5, thresholds: {}, labels: {} };
  assert.deepEqual(selectLabels({ a: 0.9, b: 0.8, c: 0.7 }, model, { maxLabels: 2 }).labels, ["a", "b"]);
  assert.deepEqual(selectLabels({ a: 0.4, b: 0.3 }, model, { minLabels: 1 }).labels, ["a"]);
});

test("rejects malformed scores", () => {
  const model = { schemaVersion: 1 as const, fittedAt: "now", fallbackThreshold: 0.5, thresholds: {}, labels: {} };
  assert.throws(() => selectLabels({ bad: 2 }, model), /between 0 and 1/);
});
