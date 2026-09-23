import type { DecisionContract, Json, LintIssue, Question } from "./types.js";

const patterns: Array<{ code: string; expression: RegExp; message: string }> = [
  { code: "numeric-logic", expression: /\b(calculate|sum|average|count|how many|greater than|less than|percentage|total)\b/i, message: "Keep exact arithmetic and counting in deterministic code." },
  { code: "date-logic", expression: /\b(before|after|days? between|older than|newer than|deadline|weekday|date range)\b/i, message: "Extract date parts if needed, but compare dates in deterministic code." },
  { code: "complex-negation", expression: /\b(not|never|unless|except)\b[^.]{0,80}\b(not|never|unless|except)\b/i, message: "Multiple negations are brittle; rewrite the condition positively." },
  { code: "authorization", expression: /\b(authori[sz]e|permission|allowed to execute|grant access)\b/i, message: "A semantic model must not be the final authorization boundary." },
];

function text(value: Json | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function finiteProbability(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value >= 0 && value <= 1);
}

function lintQuestion(id: string, question: Question, issues: LintIssue[]): void {
  const path = `questions.${id}`;
  if (!question || typeof question !== "object" || !["noul", "choice", "score"].includes((question as Question).type)) {
    issues.push({ severity: "error", code: "unknown-question-type", path: `${path}.type`, message: "Question type must be noul, choice, or score." });
    return;
  }
  const instruction = text(question.instructions).trim();
  if (!instruction) issues.push({ severity: "error", code: "empty-instructions", path: `${path}.instructions`, message: "Instructions must not be empty." });
  for (const pattern of patterns) {
    if (pattern.expression.test(instruction)) issues.push({ severity: "warning", code: pattern.code, path: `${path}.instructions`, message: pattern.message });
  }
  if (question.type === "choice") {
    const keys = Object.keys(question.criteria ?? {});
    if (keys.length < 2) issues.push({ severity: "error", code: "choice-too-small", path: `${path}.criteria`, message: "Choice needs at least two options." });
    if (keys.length > 255) issues.push({ severity: "error", code: "choice-too-large", path: `${path}.criteria`, message: "Choice supports at most 255 options." });
    if (!keys.some((key) => /none|unknown|other|insufficient|review/i.test(key))) {
      issues.push({ severity: "warning", code: "no-abstention-option", path: `${path}.criteria`, message: "Consider an explicit unknown, other, or review option." });
    }
  }
  if (question.type === "score") {
    if (!Array.isArray(question.criteria) || question.criteria.length < 2) issues.push({ severity: "error", code: "score-too-small", path: `${path}.criteria`, message: "Score needs at least two ordered levels." });
    if (question.criteria.length > 10) issues.push({ severity: "error", code: "score-too-large", path: `${path}.criteria`, message: "Score supports at most ten levels." });
  }
  if (question.type === "noul" && question.criteria) {
    const yes = text(question.criteria.true).trim();
    const no = text(question.criteria.false).trim();
    if (/^(no|false|not\b)/i.test(yes) || /^(yes|true)\b/i.test(no)) {
      issues.push({ severity: "warning", code: "inverted-noul", path: `${path}.criteria`, message: "True and false criteria appear inverted." });
    }
  }
}

export function lintContract(contract: DecisionContract): LintIssue[] {
  const issues: LintIssue[] = [];
  if (contract.version !== 1) issues.push({ severity: "error", code: "unsupported-version", path: "version", message: "Only contract version 1 is supported." });
  if (!contract.name?.trim()) issues.push({ severity: "error", code: "missing-name", path: "name", message: "Contract name is required." });
  if (!contract.model?.trim()) issues.push({ severity: "error", code: "missing-model", path: "model", message: "A model identifier is required." });
  else if (/-(latest|preview)$/.test(contract.model)) issues.push({ severity: "warning", code: "moving-model-alias", path: "model", message: "Pin a versioned model before calibrating production thresholds." });
  const entries = Object.entries(contract.questions ?? {});
  if (entries.length === 0) issues.push({ severity: "error", code: "no-questions", path: "questions", message: "At least one question is required." });
  for (const [id, question] of entries) lintQuestion(id, question, issues);
  if (!finiteProbability(contract.policy?.minConfidence)) issues.push({ severity: "error", code: "invalid-confidence", path: "policy.minConfidence", message: "minConfidence must be between 0 and 1." });
  if (!finiteProbability(contract.policy?.minMargin)) issues.push({ severity: "error", code: "invalid-margin", path: "policy.minMargin", message: "minMargin must be between 0 and 1." });
  return issues;
}
