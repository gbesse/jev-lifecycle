import type { TriagePolicy } from "./types.js";

function unit(value: number): boolean { return Number.isFinite(value) && value >= 0 && value <= 1; }

export function validatePolicy(policy: TriagePolicy): string[] {
  const errors: string[] = [];
  if (policy.version !== 1) errors.push("version must be 1");
  if (!policy.name?.trim()) errors.push("name is required");
  if (!policy.model?.trim()) errors.push("model is required");
  if (!policy.teams || Object.keys(policy.teams).length < 2) errors.push("at least two teams are required");
  if (policy.teams && policy.reviewTeam in policy.teams === false) errors.push("reviewTeam must be one of teams");
  if (!unit(policy.minTeamConfidence)) errors.push("minTeamConfidence must be between 0 and 1");
  if (!unit(policy.minUrgencyConfidence)) errors.push("minUrgencyConfidence must be between 0 and 1");
  if (policy.highValueAmount !== undefined && (!Number.isFinite(policy.highValueAmount) || policy.highValueAmount < 0)) errors.push("highValueAmount must be non-negative");
  if (policy.staleAfterHours !== undefined && (!Number.isFinite(policy.staleAfterHours) || policy.staleAfterHours < 0)) errors.push("staleAfterHours must be non-negative");
  return errors;
}
