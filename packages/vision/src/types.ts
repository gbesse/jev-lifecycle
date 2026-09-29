export interface VisualInput {
  id: string;
  kind: "image" | "screenshot" | "video";
  url: string;
  mimeType?: string;
  detail?: "low" | "high" | "auto";
}

export type VisualQuestion =
  | { type: "boolean"; text: string }
  | { type: "choice"; text: string; options: string[] }
  | { type: "score"; text: string; minimum: number; maximum: number };

export interface VisionRequest {
  question: VisualQuestion;
  inputs: VisualInput[];
  context?: Record<string, unknown>;
}

export interface VisionDecision {
  selected?: string | boolean;
  score?: number;
  probabilities?: Record<string, number>;
  provider: string;
  model?: string;
  warnings?: string[];
}

export interface VisionIssue {
  code: string;
  path: string;
  message: string;
}

export interface VisionProvider {
  name: string;
  decide(request: VisionRequest, signal: AbortSignal): Promise<VisionDecision>;
}
