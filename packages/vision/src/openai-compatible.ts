import type { VisionDecision, VisionProvider, VisionRequest } from "./types.js";

export interface OpenAICompatibleVisionOptions {
  endpoint: string;
  apiKey: string;
  model: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
}

function instruction(request: VisionRequest): string {
  const contract = request.question.type === "choice"
    ? { selected: `one of: ${request.question.options.join(" | ")}`, probabilities: "optional object of probabilities" }
    : request.question.type === "boolean"
      ? { selected: "boolean", probabilities: "optional {true, false}" }
      : { score: `number from ${request.question.minimum} to ${request.question.maximum}`, probabilities: "omit" };
  return `${request.question.text}\nReturn only a JSON object matching this contract: ${JSON.stringify(contract)}`;
}

export class OpenAICompatibleVisionProvider implements VisionProvider {
  readonly name = "openai-compatible-vision";
  constructor(private readonly options: OpenAICompatibleVisionOptions) {
    if (!/^https:\/\//i.test(options.endpoint)) throw new TypeError("Vision endpoint must use HTTPS.");
  }

  async decide(request: VisionRequest, signal: AbortSignal): Promise<VisionDecision> {
    const fetcher = this.options.fetch ?? globalThis.fetch;
    const content: Array<Record<string, unknown>> = [{ type: "text", text: instruction(request) }];
    for (const input of request.inputs) {
      if (input.kind === "video") throw new TypeError("The OpenAI-compatible adapter accepts images and screenshots; use a video-capable provider for video.");
      content.push({ type: "image_url", image_url: { url: input.url, detail: input.detail ?? "auto" } });
    }
    const response = await fetcher(this.options.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.options.apiKey}`, ...this.options.headers },
      body: JSON.stringify({ model: this.options.model, messages: [{ role: "user", content }], response_format: { type: "json_object" }, temperature: 0 }),
      signal
    });
    if (!response.ok) throw Object.assign(new Error(`Vision provider returned HTTP ${response.status}.`), { status: response.status });
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = payload.choices?.[0]?.message?.content;
    if (!text) throw new Error("Vision provider returned no message content.");
    const parsed = JSON.parse(text) as Omit<VisionDecision, "provider" | "model">;
    return { ...parsed, provider: this.name, model: this.options.model };
  }
}
