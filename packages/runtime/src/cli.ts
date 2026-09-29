#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { preflight } from "./preflight.js";
import type { DecisionRequest } from "./types.js";

async function main(): Promise<void> {
  const [, , command, path, ...args] = process.argv;
  if ((command === "inspect" || command === "doctor") && path) {
    const request = JSON.parse(await readFile(path, "utf8")) as DecisionRequest;
    const limitIndex = args.indexOf("--limit");
    const reserveIndex = args.indexOf("--reserve");
    const report = preflight(request, {
      ...(limitIndex >= 0 ? { totalTokenLimit: Number(args[limitIndex + 1]) } : {}),
      ...(reserveIndex >= 0 ? { reserveTokens: Number(args[reserveIndex + 1]) } : {})
    });
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 2;
    return;
  }
  console.error("Usage: jev-runtime inspect <request.json> [--limit 64000] [--reserve 2048]");
  process.exitCode = 1;
}

await main();
