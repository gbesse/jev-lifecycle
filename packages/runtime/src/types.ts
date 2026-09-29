export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface DecisionRequest {
  question: unknown;
  state?: unknown;
  criteria?: unknown;
  metadata?: Record<string, JsonValue>;
}

export interface PreflightIssue {
  code: string;
  path: string;
  severity: "error" | "warning";
  message: string;
}

export interface BudgetEstimate {
  serializedBytes: number;
  estimatedTokens: number;
  conservativeTokens: number;
  limit: number;
  reserve: number;
  accepted: boolean;
  headroom: number;
}

export interface PreflightOptions {
  totalTokenLimit?: number;
  reserveTokens?: number;
  charsPerToken?: number;
  safetyFactor?: number;
}

export interface PreflightReport {
  ok: boolean;
  issues: PreflightIssue[];
  fingerprint?: string;
  canonicalJson?: string;
  budget?: BudgetEstimate;
}

export interface RuntimeAdapter<T = unknown> {
  name: string;
  execute(request: DecisionRequest, signal: AbortSignal): Promise<T>;
}

export interface RetryContext {
  attempt: number;
  error: unknown;
}

export interface RuntimePolicy {
  timeoutMs?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retry?: (context: RetryContext) => boolean;
}

export interface ExecutionResult<T> {
  value: T;
  provider: string;
  attempts: number;
  elapsedMs: number;
  requestFingerprint: string;
}
