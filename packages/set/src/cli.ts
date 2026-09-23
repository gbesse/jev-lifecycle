#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { fitThresholds } from "./fit.js";
import { selectLabels } from "./select.js";
import type { SetConstraints, ThresholdModel, TrainingSample } from "./types.js";

async function json<T>(path: string): Promise<T> { return JSON.parse(await readFile(path, "utf8")) as T; }
async function jsonl<T>(path: string): Promise<T[]> { return (await readFile(path, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as T); }
const args = process.argv.slice(2);
const option = (name: string): string | undefined => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
if (args[0] === "fit" && args[1]) {
  const model = fitThresholds(await jsonl<TrainingSample>(args[1]), { beta: Number(option("--beta") ?? 1), minimumSupport: Number(option("--min-support") ?? 2) });
  const output = option("--out");
  if (output) await writeFile(output, `${JSON.stringify(model, null, 2)}\n`);
  console.log(JSON.stringify(model, null, 2));
} else if (args[0] === "predict" && args[1] && option("--model")) {
  const constraints = option("--constraints") ? await json<SetConstraints>(option("--constraints") as string) : {};
  console.log(JSON.stringify(selectLabels(await json<Record<string, number>>(args[1]), await json<ThresholdModel>(option("--model") as string), constraints), null, 2));
} else {
  console.error("Usage: jev-set fit <dataset.jsonl> [--out model.json] | predict <scores.json> --model model.json [--constraints constraints.json]");
  process.exitCode = 1;
}
