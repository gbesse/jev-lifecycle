import { validateVisionDecision, validateVisionRequest } from "./validate.js";
import type { VisionDecision, VisionProvider, VisionRequest } from "./types.js";

export class VisionBridgeError extends Error {
  constructor(message: string, readonly codes: string[]) { super(message); this.name = "VisionBridgeError"; }
}

export async function decideVision(provider: VisionProvider, request: VisionRequest, options: { timeoutMs?: number } = {}): Promise<VisionDecision> {
  const requestIssues = validateVisionRequest(request);
  if (requestIssues.length > 0) throw new VisionBridgeError("Invalid vision request.", requestIssues.map((issue) => issue.code));
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 30_000;
  const timer = setTimeout(() => controller.abort(new DOMException(`Timed out after ${timeoutMs} ms`, "AbortError")), timeoutMs);
  try {
    const decision = await provider.decide(request, controller.signal);
    const outputIssues = validateVisionDecision(request, decision);
    if (outputIssues.length > 0) throw new VisionBridgeError("Provider returned a decision outside the contract.", outputIssues.map((issue) => issue.code));
    return decision;
  } finally {
    clearTimeout(timer);
  }
}
