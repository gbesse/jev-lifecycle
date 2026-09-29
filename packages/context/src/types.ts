export interface ContextEntry {
  id: string;
  value: unknown;
  priority?: number;
  relevance?: number;
  required?: boolean;
  sensitive?: boolean;
}

export interface RedactionRule {
  name: string;
  pattern: RegExp;
  replacement?: string;
}

export interface ShapeOptions {
  totalTokenLimit?: number;
  reserveTokens?: number;
  charsPerToken?: number;
  safetyFactor?: number;
  redact?: boolean;
  redactionRules?: RedactionRule[];
}

export interface EntryDecision {
  id: string;
  action: "included" | "excluded" | "redacted";
  estimatedTokens: number;
  reason: string;
}

export interface ShapeResult {
  state: Record<string, unknown>;
  fingerprint: string;
  estimatedTokens: number;
  budgetTokens: number;
  decisions: EntryDecision[];
}
