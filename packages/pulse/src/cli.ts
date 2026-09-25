#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { attachLabels } from "./labels.js";
import { buildReport } from "./metrics.js";
import { readEvents, readLabels, writeHtmlReport } from "./io.js";
import { recommendThreshold } from "./calibration.js";

const args = process.argv.slice(2);
const calibrating = args[0] === "calibrate";
const eventsPath = calibrating ? args[1] : args[0];
if (!eventsPath) {
  console.error("Usage: jev-pulse <events.jsonl> [--labels labels.jsonl] [--threshold 0.8] [--out report.json] [--html report.html] | jev-pulse calibrate <events.jsonl> [--labels labels.jsonl] [--target-accuracy 0.95] [--min-coverage 0.2] [--out policy.json]");
  process.exit(1);
}
const option = (name: string): string | undefined => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
let events = await readEvents(eventsPath);
const labelsPath = option("--labels");
if (labelsPath) events = attachLabels(events, await readLabels(labelsPath));
if (calibrating) {
  const recommendation = recommendThreshold(events, {
    targetAccuracy: Number(option("--target-accuracy") ?? 0.95),
    minCoverage: Number(option("--min-coverage") ?? 0),
    step: Number(option("--step") ?? 0.01),
    quantization: Number(option("--quantization") ?? 0.01),
    quantizationMode: args.includes("--raw-confidence") ? "raw" : "conservative",
    confidenceMode: args.includes("--observed-accuracy") ? "observed" : "wilson",
    costs: {
      accepted: Number(option("--accepted-cost") ?? 0),
      review: Number(option("--review-cost") ?? 1),
      falseAccept: Number(option("--false-accept-cost") ?? 10),
    },
  });
  const output = option("--out");
  if (output) await writeFile(output, `${JSON.stringify(recommendation, null, 2)}\n`);
  console.log(JSON.stringify(recommendation, null, 2));
  process.exit(recommendation.selected ? 0 : 2);
}
const report = buildReport(events, { threshold: Number(option("--threshold") ?? 0.8) });
const output = option("--out");
if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
const html = option("--html");
if (html) await writeHtmlReport(html, report);
console.log(JSON.stringify(report, null, 2));
