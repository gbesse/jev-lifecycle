import assert from "node:assert/strict";
import test from "node:test";
import { createReport, inspectOutput } from "../src/index.js";

test("protocol validation catches malformed probabilities", () => {
  assert.deepEqual(inspectOutput({ selected: "a", probabilities: { a: 0.9, b: 0.9 } }).map((issue) => issue.code), ["PROBABILITY_SUM"]);
});

test("report compares providers and measures repeatability", () => {
  const cases = [{ id: "c1", request: {}, expected: { kind: "choice" as const, value: "yes" } }];
  const observations = [
    { caseId: "c1", provider: "a", output: { selected: "yes", probabilities: { yes: 0.8, no: 0.2 } }, latencyMs: 10, run: 1 },
    { caseId: "c1", provider: "a", output: { selected: "yes", probabilities: { yes: 0.7, no: 0.3 } }, latencyMs: 20, run: 2 },
    { caseId: "c1", provider: "b", output: { selected: "no" }, latencyMs: 5 }
  ];
  const report = createReport(cases, observations, "2026-01-01T00:00:00.000Z");
  assert.equal(report.providers[0]?.accuracy, 1);
  assert.equal(report.providers[0]?.deterministicRate, 1);
  assert.equal(report.providers[1]?.accuracy, 0);
});
