#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { validateVisionRequest } from "./validate.js";
import type { VisionRequest } from "./types.js";

const [, , command, path] = process.argv;
if (command === "validate" && path) {
  const issues = validateVisionRequest(JSON.parse(await readFile(path, "utf8")) as VisionRequest);
  console.log(JSON.stringify({ valid: issues.length === 0, issues }, null, 2));
  if (issues.length > 0) process.exitCode = 2;
} else {
  console.error("Usage: jev-vision validate <request.json>");
  process.exitCode = 1;
}
