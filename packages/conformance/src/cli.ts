#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createReport } from "./report.js";
import type { ConformanceCase, Observation } from "./types.js";

async function json<T>(path: string): Promise<T> { return JSON.parse(await readFile(path, "utf8")) as T; }
async function jsonl<T>(path: string): Promise<T[]> { return (await readFile(path, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as T); }

const [, , command, casesPath, observationsPath] = process.argv;
if (command === "report" && casesPath && observationsPath) {
  console.log(JSON.stringify(createReport(await json<ConformanceCase[]>(casesPath), await jsonl<Observation>(observationsPath)), null, 2));
} else {
  console.error("Usage: jev-conformance report <cases.json> <observations.jsonl>");
  process.exitCode = 1;
}
