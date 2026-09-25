export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type NoulQuestion = {
  type: "noul";
  instructions: Json;
  criteria?: { true?: Json; false?: Json };
};

export type ChoiceQuestion = {
  type: "choice";
  instructions: Json;
  criteria: Record<string, Json>;
};

export type ScoreQuestion = {
  type: "score";
  instructions: Json;
  criteria: Json[];
};

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion;

export type DecisionContract = {
  version: 1;
  name: string;
  model: string;
  questions: Record<string, Question>;
  policy?: {
    minConfidence?: number;
    minMargin?: number;
    maxStateCharacters?: number;
  };
};

export type LintIssue = {
  severity: "error" | "warning";
  code: string;
  path: string;
  message: string;
};

export type ComparableAnswer = {
  type: "noul" | "choice" | "score";
  noul?: number;
  choice?: string;
  score?: number;
  probabilities?: Record<string, number>;
  confidence?: number;
};

export type DecisionResponse = {
  model: string;
  answers: Record<string, ComparableAnswer>;
};

export type StabilityObservation = {
  caseId: string;
  kind: "baseline" | "permutation";
  repetition: number;
  response: DecisionResponse;
};

export type StabilityQuestionReport = {
  question: string;
  runs: number;
  consensusChoice: string | null;
  consensusRate: number | null;
  fixedOrderFlipRate: number | null;
  permutationFlipRate: number | null;
  strictArgmaxMismatches: number;
  materialArgmaxMismatches: number;
  maximumArgmaxGap: number;
  maximumProbabilityDelta: number;
};

export type StabilityReport = {
  schemaVersion: 1;
  runs: number;
  tolerance: number;
  stable: boolean;
  questions: Record<string, StabilityQuestionReport>;
};

export type StabilityProvider = (
  request: { state: Json; model: string; questions: Record<string, Question> },
  signal: AbortSignal,
) => Promise<DecisionResponse>;
