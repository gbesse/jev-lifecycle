#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { validateRouterConfig } from "./config.js";
import { createJevHttpProvider } from "./provider.js";
import { JevRouter } from "./router.js";
import type { Json, RouterFileConfig } from "./types.js";

const args = process.argv.slice(2);
const option = (name: string): string | undefined => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const command = args[0];
const configPath = option("--config");
if (!configPath || !["check", "route"].includes(command ?? "")) {
  console.error("Usage: jev-router check --config router.json | jev-router route --config router.json --state state.json [--history history.json] [--out result.json]");
  process.exit(1);
}
const config = JSON.parse(await readFile(configPath, "utf8")) as RouterFileConfig;
const errors = validateRouterConfig(config);
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
if (command === "check") {
  console.log(`valid: ${config.name}, ${config.routes.length} routes, ${config.providers.length} provider(s)`);
  process.exit(0);
}
const statePath = option("--state");
if (!statePath) throw new Error("--state is required");
const providers = config.providers.map((provider) => {
  const apiKey = provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : undefined;
  if (provider.apiKeyEnv && !apiKey) throw new Error(`${provider.apiKeyEnv} is required`);
  return createJevHttpProvider(provider, apiKey);
});
const router = new JevRouter(config, providers);
const state = JSON.parse(await readFile(statePath, "utf8")) as Json;
const historyPath = option("--history");
const history = historyPath ? JSON.parse(await readFile(historyPath, "utf8")) as string[] : undefined;
const result = await router.route(state, history === undefined ? {} : { history });
const output = option("--out");
if (output) await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify(result, null, 2));
if (result.status === "abstained") process.exitCode = 2;
