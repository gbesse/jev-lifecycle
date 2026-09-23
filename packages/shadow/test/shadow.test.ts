import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { agreementRate, compareDecisions, createShadowServer, normalizeJevResponse, runShadow } from "../src/index.js";

async function listen(server: ReturnType<typeof createServer>): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return address.port;
}

test("normalizes all three Jev answer types", () => {
  const result = normalizeJevResponse({ model: "jev-1.13.0", answers: { yes: { type: "noul", noul: 0.8 }, route: { type: "choice", choice: "billing", confidence: 0.9 }, risk: { type: "score", score: 1.2, confidence: 0.7 } }, usage: { input_tokens: 10, output_tokens: 3 } });
  assert.deepEqual(result.decisions, { yes: 0.8, route: "billing", risk: 1.2 });
  assert.equal(result.inputTokens, 10);
});

test("compares missing and disagreeing decisions", () => {
  const diffs = compareDecisions({ decisions: { a: "x", b: true } }, { decisions: { a: "y", c: 3 } });
  assert.equal(diffs.length, 3);
  assert.equal(agreementRate(diffs), 0);
});

test("compares probabilistic numeric decisions with tolerance", () => {
  const close = compareDecisions({ decisions: { refund: 0.81 } }, { decisions: { refund: 0.79 } });
  const far = compareDecisions({ decisions: { refund: 0.81 } }, { decisions: { refund: 0.6 } });
  assert.equal(close[0]?.agrees, true);
  assert.equal(far[0]?.agrees, false);
  assert.ok((far[0]?.valueDelta ?? 0) > 0.2);
});

test("returns the primary before comparison and records no input", async () => {
  const primary = async () => ({ envelope: { decisions: { route: "a" }, model: "primary" }, raw: { ok: "primary" } });
  const shadow = async () => ({ envelope: { decisions: { route: "b" }, model: "shadow" } });
  const run = await runShadow({ secret: "not-in-event" }, primary, shadow, { traceId: "t-1" });
  assert.deepEqual(run.primary.raw, { ok: "primary" });
  const event = await run.comparison;
  assert.equal(event.agreement, 0);
  assert.equal(JSON.stringify(event).includes("not-in-event"), false);
});

test("sampling can skip the shadow provider", async () => {
  let called = false;
  const run = await runShadow("state", async () => ({ envelope: { decisions: { x: true } } }), async () => { called = true; return { envelope: { decisions: { x: true } } }; }, { traceId: "skip", sampleRate: 0 });
  const event = await run.comparison;
  assert.equal(called, false);
  assert.equal(event.sampled, false);
});

test("primary errors fail closed", async () => {
  await assert.rejects(() => runShadow("state", async () => { throw new Error("primary down"); }, async () => ({ envelope: { decisions: {} } })), /primary down/);
});

test("HTTP server returns primary response and persists a privacy-safe comparison", async (context) => {
  const upstream = (choice: string) => createServer(async (request, response) => {
    for await (const _chunk of request) { /* drain */ }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ model: choice, answers: { route: { type: "choice", choice, probabilities: { primary: choice === "primary" ? 1 : 0, shadow: choice === "shadow" ? 1 : 0 }, confidence: 1 } }, usage: { input_tokens: 10, output_tokens: 2 } }));
  });
  const primary = upstream("primary");
  const shadow = upstream("shadow");
  const primaryPort = await listen(primary);
  const shadowPort = await listen(shadow);
  const directory = await mkdtemp(join(tmpdir(), "jev-shadow-"));
  const eventPath = join(directory, "events.jsonl");
  const proxy = createShadowServer({ primaryUrl: `http://127.0.0.1:${primaryPort}`, shadowUrl: `http://127.0.0.1:${shadowPort}`, eventPath });
  const proxyPort = await listen(proxy);
  context.after(() => { primary.close(); shadow.close(); proxy.close(); });
  const response = await fetch(`http://127.0.0.1:${proxyPort}/v1/systemone`, { method: "POST", headers: { "content-type": "application/json", "x-request-id": "integration" }, body: JSON.stringify({ state: "private ticket", model: "jev", questions: {} }) });
  assert.equal(response.status, 200);
  assert.equal(((await response.json()) as { model: string }).model, "primary");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { if ((await readFile(eventPath, "utf8")).trim()) break; } catch { /* comparison is still finishing */ }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const content = await readFile(eventPath, "utf8");
  assert.equal(content.includes("private ticket"), false);
  assert.equal((JSON.parse(content) as { agreement: number }).agreement, 0);
});
