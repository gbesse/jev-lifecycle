export type TrainingSample = {
  id?: string;
  scores: Record<string, number>;
  labels: string[];
};

export type FitOptions = {
  beta?: number;
  minimumSupport?: number;
  fallbackThreshold?: number;
};

export type LabelFit = {
  threshold: number;
  support: number;
  precision: number;
  recall: number;
  fBeta: number;
};

export type ThresholdModel = {
  schemaVersion: 1;
  fittedAt: string;
  thresholds: Record<string, number>;
  labels: Record<string, LabelFit>;
  fallbackThreshold: number;
};

export type SetConstraints = {
  parents?: Record<string, string>;
  exclusiveGroups?: string[][];
  minLabels?: number;
  maxLabels?: number;
};

export type Selection = {
  labels: string[];
  rejected: Record<string, "below-threshold" | "exclusive" | "max-labels">;
  appliedParents: string[];
};
