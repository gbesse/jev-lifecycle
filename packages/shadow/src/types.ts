export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type DecisionValue = string | number | boolean;

export type DecisionEnvelope = {
  decisions: Record<string, DecisionValue>;
  confidence?: Record<string, number>;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
};

export type ProviderResult = {
  envelope: DecisionEnvelope;
  raw?: unknown;
};

export type DecisionProvider<TInput = Json> = (input: TInput, signal: AbortSignal) => Promise<ProviderResult>;

export type DecisionDiff = {
  key: string;
  primary?: DecisionValue;
  shadow?: DecisionValue;
  agrees: boolean;
  confidenceDelta?: number;
  valueDelta?: number;
};

export type ShadowEvent = {
  schemaVersion: 1;
  id: string;
  traceId: string;
  timestamp: string;
  inputHash: string;
  sampled: boolean;
  primary: { ok: boolean; latencyMs: number; model?: string; error?: string };
  shadow: { ok: boolean; latencyMs: number; model?: string; error?: string };
  agreement?: number;
  diffs: DecisionDiff[];
};

export type ShadowOptions = {
  traceId?: string;
  sampleRate?: number;
  timeoutMs?: number;
  onEvent?: (event: ShadowEvent) => void | Promise<void>;
};
