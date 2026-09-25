import type { DecisionProvider, HttpProviderConfig, Json, ProviderDecision } from "./types.js";

function local(url: URL): boolean { return url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname); }

export function createJevHttpProvider(config: HttpProviderConfig, apiKey?: string): DecisionProvider {
  const endpoint = new URL(config.endpoint);
  if (endpoint.protocol !== "https:" && !local(endpoint)) throw new Error("provider endpoint must use HTTPS or loopback HTTP");
  if (apiKey !== undefined && (!apiKey.trim() || /[\r\n]/.test(apiKey))) throw new Error("api key is invalid");
  return {
    name: config.name,
    async decide(request, signal): Promise<ProviderDecision> {
      const timeout = AbortSignal.timeout(config.timeoutMs ?? 15_000);
      const response = await fetch(endpoint, {
        method: "POST",
        signal: AbortSignal.any([signal, timeout]),
        headers: { "content-type": "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify({ state: request.state, model: request.model, questions: { [request.question.name]: { type: "choice", instructions: request.question.instructions, criteria: request.question.criteria } } }),
      });
      if (!response.ok) throw new Error(`provider returned HTTP ${response.status}`);
      const payload = await response.json() as { model?: unknown; answers?: { route?: { choice?: unknown; probabilities?: unknown; confidence?: unknown } }; usage?: { input_tokens?: unknown; output_tokens?: unknown }; metadata?: unknown };
      const answer = payload.answers?.route;
      return {
        model: typeof payload.model === "string" ? payload.model : request.model,
        choice: typeof answer?.choice === "string" ? answer.choice : "",
        probabilities: answer?.probabilities && typeof answer.probabilities === "object" ? answer.probabilities as Record<string, number> : {},
        ...(typeof answer?.confidence === "number" ? { confidence: answer.confidence } : {}),
        ...(payload.usage ? { usage: { ...(typeof payload.usage.input_tokens === "number" ? { inputTokens: payload.usage.input_tokens } : {}), ...(typeof payload.usage.output_tokens === "number" ? { outputTokens: payload.usage.output_tokens } : {}) } } : {}),
        ...(payload.metadata && typeof payload.metadata === "object" ? { metadata: payload.metadata as Record<string, Json> } : {}),
      };
    },
  };
}
