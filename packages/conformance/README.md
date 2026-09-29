# @gbesse/jev-conformance

Reproducible compatibility and quality reports for Jev-compatible decision engines. The same cases can be replayed against hosted, gateway, or local providers, then compared without conflating protocol compatibility with decision quality.

```bash
jev-conformance report cases.json observations.jsonl > report.json
```

Reports include protocol validity, accuracy when labels exist, boolean Brier score, repeatability, latency percentiles, and recorded cost. The package does not execute arbitrary provider code: capture observations in your own isolated runner and use this package for deterministic analysis.

```ts
import { createReport } from "@gbesse/jev-conformance";
const report = createReport(cases, observations);
```

Never place secrets in cases or observations. Prefer redacted fixtures and stable case identifiers.
