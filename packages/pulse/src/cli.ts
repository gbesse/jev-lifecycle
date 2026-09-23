#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { attachLabels } from "./labels.js";
import { buildReport } from "./metrics.js";
import { readEvents, readLabels, writeHtmlReport } from "./io.js";

const args = process.argv.slice(2);
const eventsPath = args[0];
if (!eventsPath) {
  console.error("Usage: jev-pulse <events.jsonl> [--labels labels.jsonl] [--threshold 0.8] [--out report.json] [--html report.html]");
  process.exit(1);
}
const option = (name: string): string | undefined => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
let events = await readEvents(eventsPath);
const labelsPath = option("--labels");
if (labelsPath) events = attachLabels(events, await readLabels(labelsPath));
const report = buildReport(events, { threshold: Number(option("--threshold") ?? 0.8) });
const output = option("--out");
if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
const html = option("--html");
if (html) await writeHtmlReport(html, report);
console.log(JSON.stringify(report, null, 2));
