import { readFile, writeFile } from "node:fs/promises";
import type { DecisionEvent, LabelEvent, PulseReport } from "./types.js";

export async function readJsonl<T>(path: string): Promise<T[]> {
  const content = await readFile(path, "utf8");
  return content.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
    try { return JSON.parse(line) as T; } catch { throw new Error(`invalid JSON on line ${index + 1} of ${path}`); }
  });
}

export async function readEvents(path: string): Promise<DecisionEvent[]> { return readJsonl<DecisionEvent>(path); }
export async function readLabels(path: string): Promise<LabelEvent[]> { return readJsonl<LabelEvent>(path); }

function escape(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export async function writeHtmlReport(path: string, report: PulseReport): Promise<void> {
  const metric = (value: number | null): string => value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Jev Pulse report</title><style>body{font:16px system-ui;max-width:960px;margin:40px auto;padding:0 20px;color:#172033}h1{margin-bottom:4px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.card{border:1px solid #d7deea;border-radius:12px;padding:16px}.value{font-size:28px;font-weight:700}table{border-collapse:collapse;width:100%;margin-top:20px}th,td{text-align:left;border-bottom:1px solid #e4e9f1;padding:8px}</style><h1>Jev Pulse</h1><p>Generated ${escape(report.generatedAt)}</p><div class="grid"><div class="card"><div>Total</div><div class="value">${report.total}</div></div><div class="card"><div>Accuracy</div><div class="value">${metric(report.accuracy)}</div></div><div class="card"><div>Coverage</div><div class="value">${metric(report.coverage)}</div></div><div class="card"><div>Selective accuracy</div><div class="value">${metric(report.selectiveAccuracy)}</div></div><div class="card"><div>ECE</div><div class="value">${metric(report.ece)}</div></div><div class="card"><div>P95 latency</div><div class="value">${report.latencyMs.p95?.toFixed(0) ?? "n/a"} ms</div></div></div><h2>Models</h2><table><tr><th>Model</th><th>Count</th><th>Accuracy</th><th>Mean confidence</th></tr>${Object.entries(report.byModel).map(([model, row]) => `<tr><td>${escape(model)}</td><td>${row.count}</td><td>${metric(row.accuracy)}</td><td>${metric(row.meanConfidence)}</td></tr>`).join("")}</table></html>`;
  await writeFile(path, html);
}
