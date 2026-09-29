import assert from "node:assert/strict";
import test from "node:test";
import { canonicalStringify, execute, preflight, UnsafeJsonError } from "../src/index.js";

test("canonical serialization is stable and rejects non-finite numbers", () => {
  assert.equal(canonicalStringify({ z: 1, a: { d: 2, c: 3 } }), '{"a":{"c":3,"d":2},"z":1}');
  assert.throws(() => canonicalStringify({ score: Number.NaN }), UnsafeJsonError);
});

test("preflight rejects invalid questions and reports budget", () => {
  assert.equal(preflight({ question: { type: "noul", question: "" } }).ok, false);
  const report = preflight({ question: { type: "choice", options: ["yes", "no"] }, state: { value: 1 } });
  assert.equal(report.ok, true);
  assert.ok(report.budget && report.budget.headroom > 0);
  assert.equal(report.fingerprint?.length, 64);
});

test("execution retries transient failures", async () => {
  let calls = 0;
  const result = await execute({ name: "fixture", async execute() { calls += 1; if (calls < 2) throw Object.assign(new Error("busy"), { status: 503 }); return "ok"; } }, { question: { type: "noul", question: "Proceed?" } }, { baseDelayMs: 1 });
  assert.equal(result.value, "ok");
  assert.equal(result.attempts, 2);
});

test("execution enforces timeout when an adapter ignores the signal", async () => {
  const started = Date.now();
  await assert.rejects(() => execute({ name: "stuck", async execute() { return await new Promise<string>(() => undefined); } }, { question: { type: "noul", question: "Proceed?" } }, { timeoutMs: 5, maxAttempts: 1 }), (error: unknown) => error instanceof Error && error.message.includes("1 attempt"));
  assert.ok(Date.now() - started < 250);
});
