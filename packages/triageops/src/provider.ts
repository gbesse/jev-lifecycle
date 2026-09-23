import type { TriageProvider } from "./types.js";

export function createJevProvider(options: { endpoint?: string; apiKey: string; timeoutMs?: number }): TriageProvider {
  const endpoint = new URL(options.endpoint ?? "https://api.typesafe.ai/v1/systemone");
  if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(endpoint.hostname))) throw new Error("endpoint must use HTTPS or loopback HTTP");
  if (!options.apiKey.trim() || /[\r\n]/.test(options.apiKey)) throw new Error("apiKey is invalid");
  return async (request, signal) => {
    const timeout = AbortSignal.timeout(options.timeoutMs ?? 15_000);
    const combined = AbortSignal.any([signal, timeout]);
    const response = await fetch(endpoint, { method: "POST", signal: combined, headers: { authorization: `Bearer ${options.apiKey}`, "content-type": "application/json" }, body: JSON.stringify(request) });
    if (!response.ok) throw new Error(`Jev returned HTTP ${response.status}`);
    return await response.json() as Awaited<ReturnType<TriageProvider>>;
  };
}
