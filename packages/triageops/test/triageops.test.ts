import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createTriageServer, JsonlReviewStore, triageTicket, validatePolicy, type Ticket, type TriagePolicy, type TriageProvider } from "../src/index.js";

async function listen(server: ReturnType<typeof createServer>): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return address.port;
}

const policy: TriagePolicy = { version: 1, name: "support", model: "jev-1.13.0", mode: "active", teams: { billing: "Payments", technical: "Technical issues", review: "Human review" }, minTeamConfidence: 0.8, minUrgencyConfidence: 0.7, highValueAmount: 250, staleAfterHours: 48, reviewTeam: "review" };
const ticket: Ticket = { id: "T-1", receivedAt: "2026-09-20T00:00:00Z", amount: 300, messages: [{ author: "customer", text: "Please refund the duplicate charge." }] };
const provider = (overrides: Partial<{ teamConfidence: number; team: string; refund: number }> = {}): TriageProvider => async () => ({ model: "jev-1.13.0", answers: { team: { type: "choice", choice: overrides.team ?? "billing", probabilities: { billing: 0.9, technical: 0.05, review: 0.05 }, confidence: overrides.teamConfidence ?? 0.9 }, urgency: { type: "score", score: 1, probabilities: { "0": 0.1, "1": 0.8, "2": 0.1 }, confidence: 0.8 }, refund: { type: "noul", noul: overrides.refund ?? 0.9 }, abuse: { type: "noul", noul: 0.01 } }, usage: { input_tokens: 50, output_tokens: 12 } });

test("validates policy boundaries", () => {
  assert.deepEqual(validatePolicy(policy), []);
  assert.ok(validatePolicy({ ...policy, minTeamConfidence: 2 }).length > 0);
});

test("keeps date and amount logic deterministic and routes high-value refunds to review", async () => {
  const result = await triageTicket(ticket, policy, provider(), { now: new Date("2026-09-23T00:00:00Z") });
  assert.equal(result.derived.ageHours, 72);
  assert.equal(result.derived.highValue, true);
  assert.equal(result.action.route, "review");
  assert.ok(result.action.reasons.includes("high-value-refund"));
  assert.equal(JSON.stringify(result).includes(ticket.messages[0]?.text ?? ""), false);
});

test("active mode commits a sufficiently confident bounded route", async () => {
  const result = await triageTicket({ ...ticket, amount: 10 }, policy, provider({ refund: 0.1 }), { now: new Date("2026-09-20T01:00:00Z") });
  assert.equal(result.action.committed, true);
  assert.equal(result.action.route, "billing");
});

test("shadow mode never commits", async () => {
  const result = await triageTicket({ ...ticket, amount: 10 }, { ...policy, mode: "shadow" }, provider({ refund: 0.1 }), { now: new Date("2026-09-20T01:00:00Z") });
  assert.equal(result.action.committed, false);
});

test("review store is idempotent per pending ticket and records a resolution", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jev-triage-"));
  const store = new JsonlReviewStore(join(directory, "reviews.jsonl"));
  const result = await triageTicket(ticket, policy, provider(), { now: new Date("2026-09-23T00:00:00Z") });
  const first = await store.create(result);
  const second = await store.create(result);
  assert.equal(first.id, second.id);
  const resolved = await store.resolve(first.id, { status: "corrected", actor: "agent-1", team: "technical" });
  assert.equal(resolved.status, "corrected");
  assert.equal((await store.list())[0]?.resolution?.team, "technical");
});

test("malformed provider distributions fail closed", async () => {
  const bad: TriageProvider = async () => ({ model: "jev", answers: { team: { type: "choice", choice: "billing", probabilities: { billing: 2, technical: 0, review: 0 }, confidence: 0.9 }, urgency: { type: "score", score: 1, probabilities: { "0": 0, "1": 1 }, confidence: 0.9 }, refund: { type: "noul", noul: 0 }, abuse: { type: "noul", noul: 0 } } });
  await assert.rejects(() => triageTicket(ticket, policy, bad), /invalid probability/);
});

test("HTTP server authenticates, triages, and exposes the review queue", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "jev-triage-http-"));
  const server = createTriageServer({ policy, provider: provider(), reviewStore: new JsonlReviewStore(join(directory, "reviews.jsonl")), token: "test-token" });
  const port = await listen(server);
  context.after(() => server.close());
  const unauthorized = await fetch(`http://127.0.0.1:${port}/v1/reviews`);
  assert.equal(unauthorized.status, 401);
  const triage = await fetch(`http://127.0.0.1:${port}/v1/triage`, { method: "POST", headers: { authorization: "Bearer test-token", "content-type": "application/json" }, body: JSON.stringify(ticket) });
  assert.equal(triage.status, 200);
  const payload = await triage.json() as { review: { id: string }; result: { action: { reviewRequired: boolean } } };
  assert.equal(payload.result.action.reviewRequired, true);
  const reviews = await fetch(`http://127.0.0.1:${port}/v1/reviews`, { headers: { authorization: "Bearer test-token" } });
  const list = await reviews.json() as { reviews: Array<{ id: string }> };
  assert.equal(list.reviews[0]?.id, payload.review.id);
});
