import type { RouterConfig, RouterFileConfig } from "./types.js";

const idPattern = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/;

export function validateRouterConfig(config: RouterConfig | RouterFileConfig): string[] {
  const errors: string[] = [];
  if (config.version !== 1) errors.push("version must be 1");
  if (!config.name?.trim()) errors.push("name is required");
  if (!config.model?.trim()) errors.push("model is required");
  if (!config.instructions?.trim()) errors.push("instructions are required");
  if ((config.instructions?.length ?? 0) > 10_000) errors.push("instructions exceed 10000 characters");
  if (!Array.isArray(config.routes) || config.routes.length < 2) errors.push("at least two routes are required");
  if ((config.routes?.length ?? 0) > 10_000) errors.push("routes exceed the 10000 item limit");
  const ids = new Set<string>();
  for (const route of config.routes ?? []) {
    if (!idPattern.test(route.id) || route.id.startsWith("__")) errors.push(`invalid route id: ${route.id}`);
    if (ids.has(route.id)) errors.push(`duplicate route id: ${route.id}`);
    ids.add(route.id);
    if (!route.description?.trim()) errors.push(`route ${route.id} needs a description`);
    if (route.description?.length > 2_000) errors.push(`route ${route.id} description exceeds 2000 characters`);
    if ((route.group?.length ?? 0) > 128) errors.push(`route ${route.id} group exceeds 128 characters`);
  }
  if (!Number.isFinite(config.minConfidence) || config.minConfidence < 0 || config.minConfidence > 1) errors.push("minConfidence must be between 0 and 1");
  if (config.fallbackRoute && !ids.has(config.fallbackRoute)) errors.push("fallbackRoute must name a configured route");
  if (config.maxRepeatedSelection !== undefined && (!Number.isInteger(config.maxRepeatedSelection) || config.maxRepeatedSelection < 1)) errors.push("maxRepeatedSelection must be a positive integer");
  if (config.historyWindow !== undefined && (!Number.isInteger(config.historyWindow) || config.historyWindow < 1)) errors.push("historyWindow must be a positive integer");
  try { if (config.maxChoices !== undefined) { const value = config.maxChoices; if (!Number.isInteger(value) || value < 2 || value > 50) throw new Error(); } } catch { errors.push("maxChoices must be an integer between 2 and 50"); }
  if ("providers" in config) {
    if (!Array.isArray(config.providers) || !config.providers.length) errors.push("at least one provider is required");
    for (const provider of config.providers ?? []) {
      if (!provider.name?.trim()) errors.push("provider name is required");
      try {
        const url = new URL(provider.endpoint);
        if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname))) errors.push(`provider ${provider.name} endpoint must use HTTPS or loopback HTTP`);
      } catch { errors.push(`provider ${provider.name} endpoint is invalid`); }
      if (provider.apiKeyEnv && !/^[A-Z_][A-Z0-9_]*$/.test(provider.apiKeyEnv)) errors.push(`provider ${provider.name} apiKeyEnv is invalid`);
    }
  }
  return errors;
}
