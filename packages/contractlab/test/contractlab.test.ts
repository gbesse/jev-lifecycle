import assert from "node:assert/strict";
import test from "node:test";
import { canonicalize, compareResponses, fingerprint, generateMutations, lintContract } from "../src/index.js";

test("canonical fingerprints ignore object key order", () => {
  assert.equal(canonicalize({ b: 2, a: 1 }), canonicalize({ a: 1, b: 2 }));
  assert.equal(fingerprint({ b: 2, a: 1 }), fingerprint({ a: 1, b: 2 }));
});

test("lint rejects invalid shapes and warns about moving aliases", () => {
  const issues = lintContract({ version: 1, name: "triage", model: "jev-latest", questions: { route: { type: "choice", instructions: "Which route?", criteria: { billing: "Billing" } } } });
  assert.ok(issues.some((issue) => issue.code === "moving-model-alias"));
  assert.ok(issues.some((issue) => issue.code === "choice-too-small"));
});

test("lint identifies deterministic and authorization work", () => {
  const issues = lintContract({ version: 1, name: "bad", model: "jev-1.13.0", questions: { gate: { type: "noul", instructions: "Calculate the total and authorize access" } } });
  assert.ok(issues.some((issue) => issue.code === "numeric-logic"));
  assert.ok(issues.some((issue) => issue.code === "authorization"));
});

test("lint fails closed on an unknown runtime question type", () => {
  const issues = lintContract({ version: 1, name: "bad", model: "jev-1.13.0", questions: { broken: { type: "boolean", instructions: "Is this valid?" } } } as never);
  assert.ok(issues.some((issue) => issue.code === "unknown-question-type"));
});

test("mutations preserve a deterministic set of cases", () => {
  const mutations = generateMutations({ message: "hello", nested: { x: "y" } });
  assert.deepEqual(mutations.map((item) => item.id), ["key-order", "whitespace", "distractor"]);
  assert.equal(mutations.length, 3);
});

test("response comparison detects decision and distribution drift", () => {
  const diffs = compareResponses(
    { model: "a", answers: { route: { type: "choice", choice: "a", probabilities: { a: 0.8, b: 0.2 }, confidence: 0.7 } } },
    { model: "b", answers: { route: { type: "choice", choice: "b", probabilities: { a: 0.4, b: 0.6 }, confidence: 0.2 } } },
  );
  assert.equal(diffs[0]?.decisionChanged, true);
  assert.ok((diffs[0]?.maxProbabilityDelta ?? 0) > 0.3);
});
