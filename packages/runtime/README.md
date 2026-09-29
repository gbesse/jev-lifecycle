# @gbesse/jev-runtime

Fail-fast request validation and resilient execution for Jev-compatible decision APIs. It prevents silent JSON mutation, fingerprints the exact wire payload, provides a conservative request budget, and wraps provider calls with bounded timeouts and retries.

```ts
import { preflight, execute } from "@gbesse/jev-runtime";

const request = {
  question: { type: "choice", options: ["approve", "review", "reject"] },
  state: { risk: 0.42 }
};

const report = preflight(request, { totalTokenLimit: 64_000, reserveTokens: 4_000 });
if (!report.ok) throw new Error(report.issues.map((issue) => issue.message).join("; "));

const result = await execute(adapter, request, { timeoutMs: 8_000, maxAttempts: 2 });
```

The token budget is intentionally described as an estimate, not an official tokenizer result. Keep a safety reserve and reconcile estimates with provider usage.

```bash
jev-runtime inspect request.json --limit 64000 --reserve 4096
```

No telemetry is emitted. Errors and CLI output never include environment variables or API keys.
