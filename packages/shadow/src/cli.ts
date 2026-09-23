#!/usr/bin/env node
import { createShadowServer } from "./server.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const server = createShadowServer({
  primaryUrl: required("PRIMARY_URL"),
  shadowUrl: required("SHADOW_URL"),
  ...(process.env.PRIMARY_TOKEN ? { primaryToken: process.env.PRIMARY_TOKEN } : {}),
  ...(process.env.SHADOW_TOKEN ? { shadowToken: process.env.SHADOW_TOKEN } : {}),
  ...(process.env.SHADOW_PROXY_TOKEN ? { inboundToken: process.env.SHADOW_PROXY_TOKEN } : {}),
  eventPath: process.env.SHADOW_EVENT_PATH ?? "output/shadow-events.jsonl",
  sampleRate: Number(process.env.SHADOW_SAMPLE_RATE ?? 1),
});

const port = Number(process.env.PORT ?? 4319);
server.listen(port, "127.0.0.1", () => console.log(`jev-shadow listening on http://127.0.0.1:${port}`));
