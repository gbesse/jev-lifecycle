export type ExpectedDecision =
  | { kind: "choice"; value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "score"; value: number; tolerance?: number };

export interface ConformanceCase {
  id: string;
  request: unknown;
  expected?: ExpectedDecision;
  tags?: string[];
}

export interface DecisionOutput {
  selected?: string | boolean;
  score?: number;
  probabilities?: Record<string, number>;
  raw?: unknown;
}

export interface Observation {
  caseId: string;
  provider: string;
  output?: DecisionOutput;
  latencyMs: number;
  cost?: number;
  error?: string;
  run?: number;
}

export interface ProtocolIssue {
  code: string;
  message: string;
}

export interface ProviderReport {
  provider: string;
  cases: number;
  successful: number;
  protocolValid: number;
  correct: number;
  accuracy?: number;
  brierScore?: number;
  deterministicRate?: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  totalCost: number;
  issues: Record<string, number>;
}

export interface ConformanceReport {
  generatedAt: string;
  providers: ProviderReport[];
}
