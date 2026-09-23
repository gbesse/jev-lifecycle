import type { DecisionEnvelope, Json } from "./types.js";

type JevAnswer = {
  type?: string;
  noul?: number;
  choice?: string;
  score?: number;
  confidence?: number;
};

export function normalizeJevResponse(value: unknown): DecisionEnvelope {
  if (!value || typeof value !== "object") throw new Error("response must be an object");
  const object = value as { model?: unknown; answers?: unknown; usage?: { input_tokens?: unknown; output_tokens?: unknown } };
  if (!object.answers || typeof object.answers !== "object" || Array.isArray(object.answers)) throw new Error("response.answers must be an object");
  const decisions: Record<string, string | number | boolean> = {};
  const confidence: Record<string, number> = {};
  for (const [key, raw] of Object.entries(object.answers as Record<string, JevAnswer>)) {
    if (!raw || typeof raw !== "object") throw new Error(`answer ${key} must be an object`);
    if (raw.type === "noul" && Number.isFinite(raw.noul)) decisions[key] = raw.noul as number;
    else if (raw.type === "choice" && typeof raw.choice === "string") decisions[key] = raw.choice;
    else if (raw.type === "score" && Number.isFinite(raw.score)) decisions[key] = raw.score as number;
    else throw new Error(`answer ${key} has no valid decision`);
    if (raw.confidence !== undefined) {
      if (!Number.isFinite(raw.confidence) || raw.confidence < 0 || raw.confidence > 1) throw new Error(`answer ${key} has invalid confidence`);
      confidence[key] = raw.confidence;
    }
  }
  const envelope: DecisionEnvelope = { decisions };
  if (Object.keys(confidence).length) envelope.confidence = confidence;
  if (typeof object.model === "string") envelope.model = object.model;
  if (Number.isFinite(object.usage?.input_tokens)) envelope.inputTokens = object.usage?.input_tokens as number;
  if (Number.isFinite(object.usage?.output_tokens)) envelope.outputTokens = object.usage?.output_tokens as number;
  return envelope;
}

export function assertJson(value: unknown): Json {
  JSON.stringify(value);
  return value as Json;
}
