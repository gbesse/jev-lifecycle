import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createJevHttpProvider } from "./provider.js";
import { runShadow } from "./runner.js";
import type { Json, ShadowEvent } from "./types.js";

export type ShadowServerOptions = {
  primaryUrl: string;
  shadowUrl: string;
  primaryToken?: string;
  shadowToken?: string;
  inboundToken?: string;
  eventPath?: string;
  sampleRate?: number;
  maxBodyBytes?: number;
};

async function readBody(request: IncomingMessage, maximum: number): Promise<Json> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > maximum) throw new Error("request body too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Json;
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

export function createShadowServer(options: ShadowServerOptions) {
  const primary = createJevHttpProvider({ url: options.primaryUrl, ...(options.primaryToken ? { token: options.primaryToken } : {}) });
  const shadow = createJevHttpProvider({ url: options.shadowUrl, ...(options.shadowToken ? { token: options.shadowToken } : {}) });
  const writeEvent = async (event: ShadowEvent): Promise<void> => {
    if (!options.eventPath) return;
    await mkdir(dirname(options.eventPath), { recursive: true });
    await appendFile(options.eventPath, `${JSON.stringify(event)}\n`, { mode: 0o600 });
  };
  return createServer(async (request, response) => {
    try {
      if (request.url === "/health" && request.method === "GET") return send(response, 200, { ok: true });
      if (request.url !== "/v1/systemone" || request.method !== "POST") return send(response, 404, { error: "not_found" });
      if (options.inboundToken && request.headers.authorization !== `Bearer ${options.inboundToken}`) return send(response, 401, { error: "unauthorized" });
      const input = await readBody(request, options.maxBodyBytes ?? 1_048_576);
      const trace = typeof request.headers["x-request-id"] === "string" ? request.headers["x-request-id"] : undefined;
      const result = await runShadow(input, primary, shadow, { ...(trace ? { traceId: trace } : {}), sampleRate: options.sampleRate ?? 1, onEvent: writeEvent });
      void result.comparison.catch(() => undefined);
      send(response, 200, result.primary.raw ?? result.primary.envelope);
    } catch (error) {
      send(response, 502, { error: "primary_provider_failed", message: error instanceof Error ? error.name : "Error" });
    }
  });
}
