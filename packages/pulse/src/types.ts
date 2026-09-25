export type Label = string | number | boolean;

export type DecisionEvent = {
  schemaVersion: 1;
  id: string;
  timestamp: string;
  contract: string;
  contractVersion: string;
  model: string;
  question: string;
  prediction: Label;
  probabilities?: Record<string, number>;
  confidence?: number;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  status?: "ok" | "error" | "review";
  label?: Label;
  slices?: Record<string, string>;
};

export type LabelEvent = { id: string; label: Label; observedAt?: string };

export type CalibrationBin = { lower: number; upper: number; count: number; meanConfidence: number; accuracy: number; gap: number };

export type PulseReport = {
  schemaVersion: 1;
  generatedAt: string;
  total: number;
  successful: number;
  labeled: number;
  errors: number;
  accuracy: number | null;
  brier: number | null;
  ece: number | null;
  highConfidenceErrors: number;
  coverage: number;
  selectiveAccuracy: number | null;
  latencyMs: { p50: number | null; p95: number | null; max: number | null };
  inputTokens: number;
  outputTokens: number;
  calibration: CalibrationBin[];
  byModel: Record<string, { count: number; accuracy: number | null; meanConfidence: number | null }>;
  bySlice: Record<string, Record<string, { count: number; accuracy: number | null }>>;
};

export type ThresholdPoint = {
  threshold: number;
  accepted: number;
  reviewed: number;
  labeledAccepted: number;
  errors: number;
  coverage: number;
  selectiveAccuracy: number | null;
  accuracyLowerBound95: number | null;
  expectedCost: number;
};

export type ThresholdOptions = {
  targetAccuracy?: number;
  minCoverage?: number;
  step?: number;
  quantization?: number;
  quantizationMode?: "raw" | "conservative";
  confidenceMode?: "observed" | "wilson";
  costs?: { accepted?: number; review?: number; falseAccept?: number };
};

export type ThresholdRecommendation = {
  schemaVersion: 1;
  labeledEvents: number;
  targetAccuracy: number;
  minCoverage: number;
  quantization: number;
  quantizationMode: "raw" | "conservative";
  confidenceMode: "observed" | "wilson";
  selected: ThresholdPoint | null;
  reason: "recommended" | "no-labeled-confidence" | "no-feasible-threshold";
  frontier: ThresholdPoint[];
};
