import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { createReceipt, digest, signReceipt, verifyReceipt } from "../src/index.js";

const keys = generateKeyPairSync("ed25519");
const privateKey = keys.privateKey.export({ format: "pem", type: "pkcs8" });
const publicKey = keys.publicKey.export({ format: "pem", type: "spki" });

test("digest is stable across object key order", () => {
  assert.equal(digest({ b: 2, a: 1 }), digest({ a: 1, b: 2 }));
});

test("signed receipts verify and tampering is detected", () => {
  const receipt = createReceipt({ id: "r1", createdAt: "2026-01-01T00:00:00.000Z", request: { q: "approve" }, decision: { selected: true }, provider: "fixture" });
  const signed = signReceipt(receipt, privateKey, "test-key");
  assert.equal(verifyReceipt(signed, publicKey), true);
  signed.receipt.provider = "tampered";
  assert.equal(verifyReceipt(signed, publicKey), false);
});

test("sensitive metadata keys are rejected", () => {
  assert.throws(() => createReceipt({ request: {}, decision: {}, provider: "fixture", metadata: { apiKey: "secret" } }));
});

test("invalid usage records are rejected", () => {
  assert.throws(() => createReceipt({ request: {}, decision: {}, provider: "fixture", usage: { amount: -1, currency: "usd" } }));
});
