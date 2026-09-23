import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Ticket, TriagePolicy, TriageProvider } from "./types.js";
import { triageTicket } from "./engine.js";
import { JsonlReviewStore } from "./review.js";

export type TriageServerOptions = { policy: TriagePolicy; provider: TriageProvider; reviewStore: JsonlReviewStore; token?: string; maxBodyBytes?: number };

async function body<T>(request: IncomingMessage, maximum: number): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) { const data = Buffer.from(chunk); size += data.length; if (size > maximum) throw new Error("body too large"); chunks.push(data); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}
function send(response: ServerResponse, status: number, value: unknown): void { response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); response.end(JSON.stringify(value)); }

export function createTriageServer(options: TriageServerOptions) {
  return createServer(async (request, response) => {
    try {
      if (request.url === "/health" && request.method === "GET") return send(response, 200, { ok: true, mode: options.policy.mode });
      if (options.token && request.headers.authorization !== `Bearer ${options.token}`) return send(response, 401, { error: "unauthorized" });
      if (request.url === "/v1/triage" && request.method === "POST") {
        const result = await triageTicket(await body<Ticket>(request, options.maxBodyBytes ?? 1_048_576), options.policy, options.provider);
        const review = result.action.reviewRequired ? await options.reviewStore.create(result) : undefined;
        return send(response, 200, { result, ...(review ? { review } : {}) });
      }
      if (request.url === "/v1/reviews" && request.method === "GET") return send(response, 200, { reviews: await options.reviewStore.list() });
      const match = request.url?.match(/^\/v1\/reviews\/([^/]+)\/resolve$/);
      if (match && request.method === "POST") return send(response, 200, { review: await options.reviewStore.resolve(match[1] as string, await body(request, 64_000)) });
      return send(response, 404, { error: "not_found" });
    } catch (error) {
      return send(response, 400, { error: "request_failed", message: error instanceof Error ? error.message.replace(/Bearer\s+\S+/gi, "Bearer [redacted]") : "Error" });
    }
  });
}
