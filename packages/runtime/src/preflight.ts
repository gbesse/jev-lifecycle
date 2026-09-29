import { canonicalStringify, fingerprint, inspectJson } from "./canonical.js";
import type { BudgetEstimate, DecisionRequest, PreflightIssue, PreflightOptions, PreflightReport } from "./types.js";

function inspectQuestion(question: unknown): PreflightIssue[] {
  if (question === null || question === undefined) return [{ code: "MISSING_QUESTION", path: "$.question", severity: "error", message: "A decision question is required." }];
  if (typeof question !== "object") return [{ code: "INVALID_QUESTION", path: "$.question", severity: "error", message: "Question must be a structured object." }];
  const record = question as Record<string, unknown>;
  const kind = typeof record.type === "string" ? record.type.toLowerCase() : undefined;
  if (kind === "noul" || kind === "boolean") {
    const text = record.question ?? record.prompt ?? record.text;
    if (typeof text !== "string" || text.trim() === "") return [{ code: "EMPTY_QUESTION", path: "$.question", severity: "error", message: "Noul/boolean questions require non-empty text." }];
  }
  if (kind === "choice") {
    const options = record.options;
    if (!Array.isArray(options) || options.length < 2) return [{ code: "INVALID_OPTIONS", path: "$.question.options", severity: "error", message: "Choice questions require at least two options." }];
    const normalized = options.map((value) => typeof value === "string" ? value.trim().toLowerCase() : JSON.stringify(value));
    if (new Set(normalized).size !== normalized.length) return [{ code: "DUPLICATE_OPTIONS", path: "$.question.options", severity: "error", message: "Choice options must be unique." }];
  }
  return [];
}

export function estimateBudget(canonicalJson: string, options: PreflightOptions = {}): BudgetEstimate {
  const bytes = Buffer.byteLength(canonicalJson, "utf8");
  const charsPerToken = options.charsPerToken ?? 3.5;
  const safetyFactor = options.safetyFactor ?? 1.25;
  const limit = options.totalTokenLimit ?? 64_000;
  const reserve = options.reserveTokens ?? 2_048;
  const estimatedTokens = Math.ceil(canonicalJson.length / charsPerToken);
  const conservativeTokens = Math.ceil(estimatedTokens * safetyFactor);
  const headroom = limit - reserve - conservativeTokens;
  return { serializedBytes: bytes, estimatedTokens, conservativeTokens, limit, reserve, accepted: headroom >= 0, headroom };
}

export function preflight(request: DecisionRequest, options: PreflightOptions = {}): PreflightReport {
  const issues = [...inspectJson(request), ...inspectQuestion(request.question)];
  if (request.state === null) issues.push({ code: "NULL_STATE", path: "$.state", severity: "error", message: "Omit state instead of sending null." });
  if (issues.some((issue) => issue.severity === "error")) return { ok: false, issues };
  const canonicalJson = canonicalStringify(request);
  const budget = estimateBudget(canonicalJson, options);
  if (!budget.accepted) issues.push({ code: "BUDGET_EXCEEDED", path: "$", severity: "error", message: `Conservative request estimate exceeds the configured limit by ${Math.abs(budget.headroom)} tokens.` });
  return { ok: issues.every((issue) => issue.severity !== "error"), issues, fingerprint: fingerprint(request), canonicalJson, budget };
}
