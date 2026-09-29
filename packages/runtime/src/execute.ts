import { preflight } from "./preflight.js";
import type { DecisionRequest, ExecutionResult, RuntimeAdapter, RuntimePolicy } from "./types.js";

export class RuntimeExecutionError extends Error {
  constructor(message: string, readonly attempts: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "RuntimeExecutionError";
  }
}

function defaultRetry(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status: unknown }).status) : undefined;
  return status === undefined || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

export async function execute<T>(adapter: RuntimeAdapter<T>, request: DecisionRequest, policy: RuntimePolicy = {}): Promise<ExecutionResult<T>> {
  const report = preflight(request);
  if (!report.ok || !report.fingerprint) throw new RuntimeExecutionError(`Preflight failed: ${report.issues.map((issue) => issue.code).join(", ")}`, 0);
  const started = Date.now();
  const maxAttempts = Math.max(1, policy.maxAttempts ?? 3);
  const timeoutMs = policy.timeoutMs ?? 15_000;
  let lastError: unknown;
  let attempts = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attempts = attempt;
    const controller = new AbortController();
    let rejectTimeout: ((reason: DOMException) => void) | undefined;
    const timeout = new Promise<never>((_resolve, reject) => { rejectTimeout = reject; });
    const timer = setTimeout(() => {
      const error = new DOMException(`Timed out after ${timeoutMs} ms`, "AbortError");
      controller.abort(error);
      rejectTimeout?.(error);
    }, timeoutMs);
    try {
      const value = await Promise.race([adapter.execute(request, controller.signal), timeout]);
      return { value, provider: adapter.name, attempts: attempt, elapsedMs: Date.now() - started, requestFingerprint: report.fingerprint };
    } catch (error) {
      lastError = error;
      const shouldRetry = (policy.retry ?? ((context) => defaultRetry(context.error)))({ attempt, error });
      if (!shouldRetry || attempt === maxAttempts) break;
      const delay = Math.min(policy.maxDelayMs ?? 5_000, (policy.baseDelayMs ?? 200) * 2 ** (attempt - 1));
      await new Promise((resolve) => setTimeout(resolve, delay));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new RuntimeExecutionError(`Provider ${adapter.name} failed after ${attempts} attempt(s).`, attempts, { cause: lastError });
}
