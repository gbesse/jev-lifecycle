export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type RouteDefinition = {
  id: string;
  description: string;
  group?: string;
  risk?: "low" | "medium" | "high";
};

export type RouterConfig = {
  version: 1;
  name: string;
  model: string;
  instructions: string;
  routes: RouteDefinition[];
  minConfidence: number;
  maxChoices?: number;
  fallbackRoute?: string;
  maxRepeatedSelection?: number;
  historyWindow?: number;
  tryNextProviderOnLowConfidence?: boolean;
};

export type ProviderRequest = {
  state: Json;
  model: string;
  question: { name: "route"; instructions: string; criteria: Record<string, string> };
};

export type ProviderDecision = {
  model: string;
  choice: string;
  probabilities: Record<string, number>;
  confidence?: number;
  usage?: { inputTokens?: number; outputTokens?: number };
  metadata?: Record<string, Json>;
};

export type DecisionProvider = {
  name: string;
  decide(request: ProviderRequest, signal: AbortSignal): Promise<ProviderDecision>;
};

export type RouteTraceStep = {
  depth: number;
  provider: string;
  candidates: string[];
  selected: string;
  confidence: number;
  model: string;
};

export type RouteResult = {
  schemaVersion: 1;
  status: "selected" | "fallback" | "abstained";
  proposedRoute: string | null;
  confidence: number | null;
  provider: string | null;
  model: string | null;
  reason: "selected" | "low-confidence" | "provider-failure" | "loop-detected";
  authorization: { state: "required"; authorized: false };
  trace: RouteTraceStep[];
  errors: Array<{ provider: string; code: "provider-error" | "invalid-response" | "low-confidence" }>;
};

export type HttpProviderConfig = { name: string; endpoint: string; apiKeyEnv?: string; timeoutMs?: number };
export type RouterFileConfig = RouterConfig & { providers: HttpProviderConfig[] };
