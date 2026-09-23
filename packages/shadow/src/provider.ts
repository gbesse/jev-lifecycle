import type { DecisionProvider, Json, ProviderResult } from "./types.js";
import { normalizeJevResponse } from "./normalize.js";

export type HttpProviderOptions = {
  url: string;
  token?: string;
  headers?: Record<string, string>;
};

export function createJevHttpProvider(options: HttpProviderOptions): DecisionProvider<Json> {
  const url = new URL(options.url);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname))) throw new Error("provider URL must use HTTPS or loopback HTTP");
  return async (input, signal): Promise<ProviderResult> => {
    const response = await fetch(url, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...options.headers,
      },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(`provider returned HTTP ${response.status}`);
    const raw: unknown = await response.json();
    return { raw, envelope: normalizeJevResponse(raw) };
  };
}
