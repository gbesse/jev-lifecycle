import type { VisionDecision, VisionIssue, VisionRequest } from "./types.js";

export function validateVisionRequest(request: VisionRequest, maxInlineBytes = 10_000_000): VisionIssue[] {
  const issues: VisionIssue[] = [];
  if (!request.question?.text?.trim()) issues.push({ code: "EMPTY_QUESTION", path: "$.question.text", message: "Question text is required." });
  if (!Array.isArray(request.inputs) || request.inputs.length === 0) issues.push({ code: "NO_INPUTS", path: "$.inputs", message: "At least one visual input is required." });
  if (request.question?.type === "choice") {
    if (request.question.options.length < 2) issues.push({ code: "INVALID_OPTIONS", path: "$.question.options", message: "Choice questions require at least two options." });
    if (new Set(request.question.options.map((option) => option.trim().toLowerCase())).size !== request.question.options.length) issues.push({ code: "DUPLICATE_OPTIONS", path: "$.question.options", message: "Choice options must be unique." });
  }
  if (request.question?.type === "score" && (!(request.question.minimum < request.question.maximum) || !Number.isFinite(request.question.minimum) || !Number.isFinite(request.question.maximum))) issues.push({ code: "INVALID_RANGE", path: "$.question", message: "Score range must be finite and increasing." });
  const ids = new Set<string>();
  for (const [index, input] of (request.inputs ?? []).entries()) {
    if (!input.id.trim() || ids.has(input.id)) issues.push({ code: "INVALID_ID", path: `$.inputs[${index}].id`, message: "Input IDs must be unique and non-empty." });
    ids.add(input.id);
    if (!/^https:\/\//i.test(input.url) && !/^data:(image|video)\//i.test(input.url)) issues.push({ code: "UNSAFE_URL", path: `$.inputs[${index}].url`, message: "Only HTTPS and image/video data URLs are accepted." });
    if (input.url.startsWith("data:") && input.url.length * 0.75 > maxInlineBytes) issues.push({ code: "INLINE_TOO_LARGE", path: `$.inputs[${index}].url`, message: "Inline media exceeds the configured byte limit." });
  }
  return issues;
}

export function validateVisionDecision(request: VisionRequest, decision: VisionDecision): VisionIssue[] {
  const issues: VisionIssue[] = [];
  if (request.question.type === "score") {
    if (decision.score === undefined || !Number.isFinite(decision.score) || decision.score < request.question.minimum || decision.score > request.question.maximum) issues.push({ code: "INVALID_SCORE", path: "$.score", message: "Provider score is missing or outside the requested range." });
  } else if (decision.selected === undefined) issues.push({ code: "MISSING_SELECTION", path: "$.selected", message: "Provider selection is missing." });
  if (request.question.type === "choice" && typeof decision.selected === "string" && !request.question.options.includes(decision.selected)) issues.push({ code: "UNKNOWN_SELECTION", path: "$.selected", message: "Provider selected an option outside the contract." });
  if (request.question.type === "boolean" && typeof decision.selected !== "boolean") issues.push({ code: "INVALID_BOOLEAN", path: "$.selected", message: "Boolean questions require a boolean selection." });
  if (decision.probabilities) {
    const probabilities = Object.values(decision.probabilities);
    if (probabilities.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) issues.push({ code: "INVALID_PROBABILITY", path: "$.probabilities", message: "Probabilities must be finite values in [0, 1]." });
    else if (probabilities.length === 0 || Math.abs(probabilities.reduce((sum, value) => sum + value, 0) - 1) > 0.02) issues.push({ code: "PROBABILITY_SUM", path: "$.probabilities", message: "Probabilities must sum to approximately 1." });
  }
  return issues;
}
