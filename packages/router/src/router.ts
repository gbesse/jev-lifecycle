import { validateRouterConfig } from "./config.js";
import { buildHierarchy, type RouteNode } from "./hierarchy.js";
import type { DecisionProvider, Json, ProviderDecision, RouteResult, RouteTraceStep, RouterConfig } from "./types.js";

function confidence(decision: ProviderDecision): number {
  const explicit = decision.confidence;
  if (typeof explicit === "number" && Number.isFinite(explicit)) return explicit;
  return decision.probabilities[decision.choice] ?? Number.NaN;
}

function valid(decision: ProviderDecision, candidates: RouteNode[]): boolean {
  const expected = candidates.map((candidate) => candidate.id).sort();
  const actual = Object.keys(decision.probabilities).sort();
  const values = Object.values(decision.probabilities);
  const score = confidence(decision);
  return expected.length === actual.length && expected.every((key, index) => key === actual[index])
    && candidates.some((candidate) => candidate.id === decision.choice)
    && values.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
    && Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) <= 0.011
    && Math.max(...values) - (decision.probabilities[decision.choice] ?? 0) <= 0.011
    && Number.isFinite(score) && score >= 0 && score <= 1;
}

function fallback(config: RouterConfig, reason: RouteResult["reason"], trace: RouteTraceStep[], errors: RouteResult["errors"]): RouteResult {
  return {
    schemaVersion: 1,
    status: config.fallbackRoute ? "fallback" : "abstained",
    proposedRoute: config.fallbackRoute ?? null,
    confidence: trace.at(-1)?.confidence ?? null,
    provider: trace.at(-1)?.provider ?? null,
    model: trace.at(-1)?.model ?? null,
    reason,
    authorization: { state: "required", authorized: false },
    trace,
    errors,
  };
}

export class JevRouter {
  readonly #config: RouterConfig;
  readonly #providers: DecisionProvider[];

  constructor(config: RouterConfig, providers: DecisionProvider[]) {
    const errors = validateRouterConfig(config);
    if (errors.length) throw new Error(`invalid router config: ${errors.join(", ")}`);
    if (!providers.length) throw new Error("at least one provider is required");
    this.#config = structuredClone(config);
    this.#providers = providers;
  }

  async route(state: Json, options: { history?: string[]; signal?: AbortSignal } = {}): Promise<RouteResult> {
    const trace: RouteTraceStep[] = [];
    const errors: RouteResult["errors"] = [];
    const signal = options.signal ?? new AbortController().signal;
    let candidates = buildHierarchy(this.#config.routes, this.#config.maxChoices ?? 12);
    for (let depth = 0; depth < 32; depth += 1) {
      let accepted: { decision: ProviderDecision; provider: DecisionProvider } | undefined;
      let sawLowConfidence = false;
      for (const provider of this.#providers) {
        try {
          const decision = await provider.decide({
            state,
            model: this.#config.model,
            question: { name: "route", instructions: this.#config.instructions, criteria: Object.fromEntries(candidates.map((candidate) => [candidate.id, candidate.description])) },
          }, signal);
          if (!valid(decision, candidates)) { errors.push({ provider: provider.name, code: "invalid-response" }); continue; }
          const score = confidence(decision);
          if (score < this.#config.minConfidence) {
            sawLowConfidence = true;
            errors.push({ provider: provider.name, code: "low-confidence" });
            if (this.#config.tryNextProviderOnLowConfidence ?? true) continue;
            return fallback(this.#config, "low-confidence", trace, errors);
          }
          accepted = { decision, provider };
          break;
        } catch {
          if (signal.aborted) throw signal.reason;
          errors.push({ provider: provider.name, code: "provider-error" });
        }
      }
      if (!accepted) return fallback(this.#config, sawLowConfidence ? "low-confidence" : "provider-failure", trace, errors);
      const selected = candidates.find((candidate) => candidate.id === accepted?.decision.choice) as RouteNode;
      const score = confidence(accepted.decision);
      trace.push({ depth, provider: accepted.provider.name, candidates: candidates.map((candidate) => candidate.id), selected: selected.id, confidence: score, model: accepted.decision.model });
      if (selected.children?.length) { candidates = selected.children; continue; }
      const proposedRoute = selected.route?.id ?? selected.id;
      const history = (options.history ?? []).slice(-(this.#config.historyWindow ?? 10));
      const repeats = history.filter((route) => route === proposedRoute).length + 1;
      if (repeats >= (this.#config.maxRepeatedSelection ?? 3)) return fallback(this.#config, "loop-detected", trace, errors);
      return {
        schemaVersion: 1,
        status: "selected",
        proposedRoute,
        confidence: score,
        provider: accepted.provider.name,
        model: accepted.decision.model,
        reason: "selected",
        authorization: { state: "required", authorized: false },
        trace,
        errors,
      };
    }
    return fallback(this.#config, "provider-failure", trace, errors);
  }
}

export type AuthorizationDecision = { route: string; allowed: boolean; reason: string };

export function authorizeRoute(result: RouteResult, policy: (route: string) => { allowed: boolean; reason: string }): AuthorizationDecision {
  if (!result.proposedRoute) return { route: "", allowed: false, reason: "no-route-proposed" };
  const decision = policy(result.proposedRoute);
  return { route: result.proposedRoute, allowed: decision.allowed, reason: decision.reason };
}
