import assert from "node:assert/strict";
import test from "node:test";
import { shapeContext } from "../src/index.js";

test("shapeContext prioritizes required and relevant entries", () => {
  const result = shapeContext([
    { id: "required", value: "policy", required: true },
    { id: "low", value: "x".repeat(200), priority: 0.1, relevance: 0.1 },
    { id: "high", value: "decision fact", priority: 1, relevance: 1 }
  ], { totalTokenLimit: 100, reserveTokens: 40, safetyFactor: 1 });
  assert.equal(result.state.required, "policy");
  assert.equal(result.state.high, "decision fact");
  assert.equal(result.decisions.find((entry) => entry.id === "low")?.action, "excluded");
});

test("shapeContext redacts common secrets and produces stable fingerprints", () => {
  const entries = [{ id: "user", value: { email: "dev@example.com", auth: "Bearer secret-token" } }];
  const first = shapeContext(entries);
  const second = shapeContext(entries);
  assert.match(JSON.stringify(first.state), /REDACTED_EMAIL/);
  assert.doesNotMatch(JSON.stringify(first.state), /secret-token/);
  assert.equal(first.fingerprint, second.fingerprint);
});

test("explicitly sensitive entries are fully replaced", () => {
  const result = shapeContext([{ id: "private", value: { nested: "must not survive" }, sensitive: true }], { redact: false });
  assert.equal(result.state.private, "[REDACTED_SENSITIVE]");
  assert.equal(result.decisions[0]?.action, "redacted");
});
