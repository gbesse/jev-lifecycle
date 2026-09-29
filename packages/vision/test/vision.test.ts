import assert from "node:assert/strict";
import test from "node:test";
import { decideVision, OpenAICompatibleVisionProvider, validateVisionDecision, validateVisionRequest, VisionBridgeError } from "../src/index.js";

const request = { question: { type: "choice" as const, text: "What state is visible?", options: ["ready", "blocked"] }, inputs: [{ id: "screen", kind: "screenshot" as const, url: "https://example.com/screen.png" }] };

test("request validation rejects unsafe local URLs", () => {
  const issues = validateVisionRequest({ ...request, inputs: [{ ...request.inputs[0]!, url: "file:///secret.png" }] });
  assert.deepEqual(issues.map((issue) => issue.code), ["UNSAFE_URL"]);
});

test("bridge validates provider output", async () => {
  const valid = await decideVision({ name: "fixture", async decide() { return { selected: "ready", provider: "fixture" }; } }, request);
  assert.equal(valid.selected, "ready");
  await assert.rejects(() => decideVision({ name: "fixture", async decide() { return { selected: "unknown", provider: "fixture" }; } }, request), VisionBridgeError);
});

test("validation covers question contracts and inline limits", () => {
  const broken = validateVisionRequest({
    question: { type: "score", text: "", minimum: 5, maximum: 1 },
    inputs: [
      { id: "same", kind: "image", url: "data:image/png;base64,AAAA" },
      { id: "same", kind: "image", url: "data:image/png;base64," + "A".repeat(100) }
    ]
  }, 10);
  assert.deepEqual(new Set(broken.map((issue) => issue.code)), new Set(["EMPTY_QUESTION", "INVALID_RANGE", "INVALID_ID", "INLINE_TOO_LARGE"]));
  assert.equal(validateVisionDecision({ question: { type: "boolean", text: "Ready?" }, inputs: request.inputs }, { selected: "yes", provider: "x" })[0]?.code, "INVALID_BOOLEAN");
  assert.equal(validateVisionDecision(request, { selected: "ready", probabilities: { ready: 0.4, blocked: 0.4 }, provider: "x" })[0]?.code, "PROBABILITY_SUM");
});

test("OpenAI-compatible adapter sends bounded JSON and parses output", async () => {
  let authorization = "";
  const provider = new OpenAICompatibleVisionProvider({
    endpoint: "https://gateway.example/v1/chat/completions",
    apiKey: "test-key",
    model: "vision-fixture",
    fetch: async (_url, init) => {
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"selected":"ready","probabilities":{"ready":0.9,"blocked":0.1}}' } }] }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });
  const result = await decideVision(provider, request);
  assert.equal(result.selected, "ready");
  assert.equal(result.model, "vision-fixture");
  assert.equal(authorization, "Bearer test-key");
  assert.throws(() => new OpenAICompatibleVisionProvider({ endpoint: "http://insecure", apiKey: "x", model: "x" }));
});

test("OpenAI-compatible adapter rejects video before sending", async () => {
  const provider = new OpenAICompatibleVisionProvider({ endpoint: "https://gateway.example/v1/chat/completions", apiKey: "x", model: "x", fetch: async () => { throw new Error("should not fetch"); } });
  await assert.rejects(() => decideVision(provider, { question: { type: "boolean", text: "Moving?" }, inputs: [{ id: "v", kind: "video", url: "https://example.com/v.mp4" }] }), /video-capable/);
});
