import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { authorizeRoute, buildHierarchy, createJevHttpProvider, JevRouter, validateRouterConfig, type DecisionProvider, type RouterConfig } from "../src/index.js";

const config: RouterConfig = {
  version: 1,
  name: "agent-tools",
  model: "jev-1.13.0",
  instructions: "Choose the single best bounded next step.",
  routes: [
    { id: "search", description: "Search public documentation", group: "read" },
    { id: "inspect", description: "Inspect a local record", group: "read" },
    { id: "email", description: "Draft an email", group: "write", risk: "high" },
    { id: "review", description: "Escalate to a human", group: "write" },
  ],
  minConfidence: 0.7,
  maxChoices: 2,
  fallbackRoute: "review",
};

function provider(name: string, choices: string[] | ((candidates: string[]) => string), score = 0.9): DecisionProvider {
  let index = 0;
  return { name, async decide(request) {
    const candidates = Object.keys(request.question.criteria);
    const choice = typeof choices === "function" ? choices(candidates) : choices[index++] ?? candidates[0] as string;
    const probabilities = Object.fromEntries(candidates.map((candidate) => [candidate, candidate === choice ? score : (1 - score) / (candidates.length - 1)]));
    return { model: request.model, choice, probabilities, confidence: score };
  } };
}

test("validates configuration and reserved identifiers", () => {
  assert.deepEqual(validateRouterConfig(config), []);
  assert.ok(validateRouterConfig({ ...config, routes: [{ id: "__bad", description: "bad" }, config.routes[1] as NonNullable<typeof config.routes[1]>] }).some((error) => error.includes("invalid route")));
});

test("builds a bounded hierarchy for a large registry", () => {
  const tree = buildHierarchy(config.routes, 2);
  assert.ok(tree.length <= 2);
  assert.ok(tree.every((node) => (node.children?.length ?? 0) <= 2));
});

test("bounds every level in very large registries", () => {
  const routes = Array.from({ length: 250 }, (_, index) => ({ id: `route_${index}`, description: `Route ${index}`, group: `group_${index}` }));
  const tree = buildHierarchy(routes, 5);
  const visit = (nodes: typeof tree): void => {
    assert.ok(nodes.length <= 5);
    for (const node of nodes) if (node.children) visit(node.children);
  };
  visit(tree);
});

test("routes hierarchically and never authorizes the proposal", async () => {
  const router = new JevRouter(config, [provider("local", (candidates) => candidates.includes("search") ? "search" : candidates[0] as string)]);
  const result = await router.route({ request: "find docs" });
  assert.equal(result.status, "selected");
  assert.equal(result.proposedRoute, "search");
  assert.deepEqual(result.authorization, { state: "required", authorized: false });
  assert.equal(result.trace.length, 2);
});

test("fails over after a provider error", async () => {
  const broken: DecisionProvider = { name: "broken", async decide() { throw new Error("offline"); } };
  const router = new JevRouter({ ...config, maxChoices: 12 }, [broken, provider("backup", (candidates) => candidates.includes("search") ? "search" : candidates[0] as string)]);
  const result = await router.route({ request: "find docs" });
  assert.equal(result.provider, "backup");
  assert.equal(result.errors.filter((error) => error.provider === "broken" && error.code === "provider-error").length, 2);
});

test("falls back on low confidence and malformed distributions", async () => {
  const malformed: DecisionProvider = { name: "bad", async decide() { return { model: "x", choice: "search", probabilities: { search: 1 } }; } };
  const router = new JevRouter({ ...config, maxChoices: 12 }, [malformed, provider("uncertain", (candidates) => candidates.includes("search") ? "search" : candidates[0] as string, 0.6)]);
  const result = await router.route({ request: "ambiguous" });
  assert.equal(result.status, "fallback");
  assert.equal(result.reason, "low-confidence");
  assert.equal(result.proposedRoute, "review");
});

test("detects repeated selections as a loop", async () => {
  const router = new JevRouter({ ...config, maxChoices: 12, maxRepeatedSelection: 3 }, [provider("local", (candidates) => candidates.includes("search") ? "search" : candidates[0] as string)]);
  const result = await router.route({}, { history: ["search", "inspect", "search"] });
  assert.equal(result.reason, "loop-detected");
  assert.equal(result.status, "fallback");
});

test("keeps authorization in deterministic caller policy", async () => {
  const router = new JevRouter({ ...config, maxChoices: 12 }, [provider("local", (candidates) => candidates.includes("email") ? "email" : candidates.at(-1) as string)]);
  const result = await router.route({});
  assert.deepEqual(authorizeRoute(result, (route) => ({ allowed: route !== "email", reason: "writes need approval" })), { route: "email", allowed: false, reason: "writes need approval" });
});

test("HTTP provider supports loopback gateways and parses Jev envelopes", async (context) => {
  const server = createServer(async (request, response) => {
    assert.equal(request.headers.authorization, "Bearer test-key");
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ model: "jev-test", answers: { route: { choice: "search", probabilities: { search: 0.9, review: 0.1 }, confidence: 0.9 } }, usage: { input_tokens: 3 } }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing address");
  const http = createJevHttpProvider({ name: "gateway", endpoint: `http://127.0.0.1:${address.port}` }, "test-key");
  const decision = await http.decide({ state: {}, model: "jev", question: { name: "route", instructions: "route", criteria: { search: "Search", review: "Review" } } }, new AbortController().signal);
  assert.equal(decision.choice, "search");
  assert.equal(decision.usage?.inputTokens, 3);
});
