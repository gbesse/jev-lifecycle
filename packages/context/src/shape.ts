import { createHash } from "node:crypto";
import type { ContextEntry, EntryDecision, RedactionRule, ShapeOptions, ShapeResult } from "./types.js";

export const defaultRedactionRules: RedactionRule[] = [
  { name: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[REDACTED_EMAIL]" },
  { name: "ipv4", pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: "[REDACTED_IP]" },
  { name: "bearer-token", pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, replacement: "Bearer [REDACTED]" }
];

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
  const result = JSON.stringify(value);
  if (result === undefined) throw new TypeError("Context entries must be JSON serializable.");
  return result;
}

function redact(value: unknown, rules: RedactionRule[]): { value: unknown; changed: boolean } {
  if (typeof value === "string") {
    let next = value;
    for (const rule of rules) next = next.replace(rule.pattern, rule.replacement ?? `[REDACTED_${rule.name.toUpperCase()}]`);
    return { value: next, changed: next !== value };
  }
  if (Array.isArray(value)) {
    const results = value.map((entry) => redact(entry, rules));
    return { value: results.map((result) => result.value), changed: results.some((result) => result.changed) };
  }
  if (value !== null && typeof value === "object") {
    let changed = false;
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) { const result = redact(entry, rules); output[key] = result.value; changed ||= result.changed; }
    return { value: output, changed };
  }
  return { value, changed: false };
}

function tokens(value: unknown, charsPerToken: number, safetyFactor: number): number {
  return Math.ceil((stable(value).length / charsPerToken) * safetyFactor);
}

export function shapeContext(entries: ContextEntry[], options: ShapeOptions = {}): ShapeResult {
  const charsPerToken = options.charsPerToken ?? 3.5;
  const safetyFactor = options.safetyFactor ?? 1.25;
  const budgetTokens = (options.totalTokenLimit ?? 32_000) - (options.reserveTokens ?? 4_096);
  if (budgetTokens < 0) throw new RangeError("Reserved tokens exceed the total token limit.");
  const rules = options.redactionRules ?? defaultRedactionRules;
  const seen = new Set<string>();
  const candidates = entries.map((entry, index) => {
    if (!entry.id.trim() || seen.has(entry.id)) throw new TypeError(`Context entry IDs must be unique and non-empty: ${entry.id}`);
    seen.add(entry.id);
    const result = entry.sensitive
      ? { value: "[REDACTED_SENSITIVE]", changed: true }
      : options.redact === false ? { value: entry.value, changed: false } : redact(entry.value, rules);
    return { entry, index, value: result.value, changed: result.changed, tokens: tokens({ [entry.id]: result.value }, charsPerToken, safetyFactor), score: (entry.priority ?? 0.5) * (entry.relevance ?? 0.5) };
  });
  candidates.sort((a, b) => Number(b.entry.required) - Number(a.entry.required) || b.score - a.score || a.index - b.index);
  const state: Record<string, unknown> = {};
  const decisions: EntryDecision[] = [];
  let used = 0;
  for (const candidate of candidates) {
    const fits = used + candidate.tokens <= budgetTokens;
    if (!fits && candidate.entry.required) throw new RangeError(`Required context entry ${candidate.entry.id} does not fit the configured budget.`);
    if (!fits) { decisions.push({ id: candidate.entry.id, action: "excluded", estimatedTokens: candidate.tokens, reason: "budget" }); continue; }
    state[candidate.entry.id] = candidate.value;
    used += candidate.tokens;
    decisions.push({ id: candidate.entry.id, action: candidate.changed ? "redacted" : "included", estimatedTokens: candidate.tokens, reason: candidate.entry.required ? "required" : "ranked" });
  }
  const canonical = stable(state);
  return { state, fingerprint: createHash("sha256").update(canonical).digest("hex"), estimatedTokens: used, budgetTokens, decisions };
}
