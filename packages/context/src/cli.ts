#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { shapeContext } from "./shape.js";
import type { ContextEntry } from "./types.js";

const [, , command, path, ...args] = process.argv;
if (command === "shape" && path) {
  const entries = JSON.parse(await readFile(path, "utf8")) as ContextEntry[];
  const limitIndex = args.indexOf("--limit");
  const reserveIndex = args.indexOf("--reserve");
  console.log(JSON.stringify(shapeContext(entries, {
    ...(limitIndex >= 0 ? { totalTokenLimit: Number(args[limitIndex + 1]) } : {}),
    ...(reserveIndex >= 0 ? { reserveTokens: Number(args[reserveIndex + 1]) } : {}),
    redact: !args.includes("--no-redact")
  }), null, 2));
} else {
  console.error("Usage: jev-context shape <entries.json> [--limit 32000] [--reserve 4096] [--no-redact]");
  process.exitCode = 1;
}
