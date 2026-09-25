import assert from "node:assert/strict";
import test from "node:test";
import { analyzeStability, canonicalize, compareResponses, createPermutationCases, fingerprint, generateMutations, lintContract, runStabilityLab, type DecisionContract, type StabilityObservation } from "../src/index.js";

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

const contract: DecisionContract = { version: 1, name: "route", model: "jev-1.13.0", questions: { route: { type: "choice", instructions: "Choose a route", criteria: { billing: "Payments", support: "Technical support", review: "Human review" } } } };

test("creates reproducible option permutations without mutating the contract", () => {
  const first = createPermutationCases(contract, 3, 42);
  const second = createPermutationCases(contract, 3, 42);
  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys((contract.questions.route as { criteria: object }).criteria), ["billing", "support", "review"]);
  assert.notDeepEqual(Object.keys((first[0]?.questions.route as { criteria: object }).criteria), Object.keys((first[1]?.questions.route as { criteria: object }).criteria));
});

test("separates fixed-order flips, permutation flips, and rounded argmax mismatches", () => {
  const observations: StabilityObservation[] = [
    { caseId: "baseline", kind: "baseline", repetition: 1, response: { model: "jev", answers: { route: { type: "choice", choice: "billing", probabilities: { billing: 0.51, support: 0.49 } } } } },
    { caseId: "baseline", kind: "baseline", repetition: 2, response: { model: "jev", answers: { route: { type: "choice", choice: "support", probabilities: { billing: 0.51, support: 0.49 } } } } },
    { caseId: "permutation-1", kind: "permutation", repetition: 1, response: { model: "jev", answers: { route: { type: "choice", choice: "support", probabilities: { billing: 0.51, support: 0.49 } } } } },
  ];
  const report = analyzeStability(observations, { tolerance: 0.021 });
  assert.equal(report.questions.route?.fixedOrderFlipRate, 0.5);
  assert.equal(report.questions.route?.permutationFlipRate, 1);
  assert.equal(report.questions.route?.strictArgmaxMismatches, 2);
  assert.equal(report.questions.route?.materialArgmaxMismatches, 0);
  assert.equal(report.stable, false);
});

test("runs the full stability matrix against an injected provider", async () => {
  let calls = 0;
  const result = await runStabilityLab(contract, { text: "hello" }, async (request) => {
    calls += 1;
    const keys = Object.keys((request.questions.route as { criteria: object }).criteria);
    return { model: request.model, answers: { route: { type: "choice", choice: "billing", probabilities: Object.fromEntries(keys.map((key) => [key, key === "billing" ? 0.8 : 0.1])) } } };
  }, { repetitions: 2, permutations: 2, seed: 7 });
  assert.equal(calls, 6);
  assert.equal(result.observations.length, 6);
  assert.equal(result.report.stable, true);
});

test("rejects invalid stability inputs", () => {
  assert.throws(() => analyzeStability([]), /at least one/);
  assert.throws(() => createPermutationCases(contract, -1), /count/);
});
