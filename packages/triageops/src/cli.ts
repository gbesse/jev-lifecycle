#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { validatePolicy } from "./policy.js";
import { createJevProvider } from "./provider.js";
import { JsonlReviewStore } from "./review.js";
import { createTriageServer } from "./server.js";
import type { TriagePolicy } from "./types.js";

const args = process.argv.slice(2);
const configIndex = args.indexOf("--config");
const configPath = configIndex >= 0 ? args[configIndex + 1] : undefined;
if (!configPath || !["check", "serve"].includes(args[0] ?? "")) {
  console.error("Usage: jev-triageops check|serve --config policy.json");
  process.exit(1);
}
const policy = JSON.parse(await readFile(configPath, "utf8")) as TriagePolicy;
const errors = validatePolicy(policy);
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
if (args[0] === "check") console.log(`valid: ${policy.name}, ${Object.keys(policy.teams).length} teams, mode=${policy.mode}`);
else {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error("TYPESAFE_API_KEY is required");
  const provider = createJevProvider({ apiKey, ...(process.env.TYPESAFE_ENDPOINT ? { endpoint: process.env.TYPESAFE_ENDPOINT } : {}) });
  const server = createTriageServer({ policy, provider, reviewStore: new JsonlReviewStore(process.env.REVIEW_PATH ?? "output/reviews.jsonl"), ...(process.env.TRIAGE_TOKEN ? { token: process.env.TRIAGE_TOKEN } : {}) });
  const port = Number(process.env.PORT ?? 4320);
  server.listen(port, "127.0.0.1", () => console.log(`jev-triageops listening on http://127.0.0.1:${port}`));
}
