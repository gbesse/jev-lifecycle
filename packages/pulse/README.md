# @gbesse/jev-pulse

Offline and CI-friendly decision observability. Pulse joins delayed labels to privacy-safe decision events, then reports accuracy, Brier score, ECE, high-confidence errors, confidence-gated coverage, selective accuracy, latency, token usage, model splits and business slices.

```bash
npm install @gbesse/jev-pulse
npx jev-pulse events.jsonl \
  --labels labels.jsonl \
  --threshold 0.8 \
  --out report.json \
  --html report.html
```

Events contain decision metadata, not raw state. Labels can arrive later under the same event id. Missing labels remain unknown and are never counted as errors or successes.

```ts
import { attachLabels, buildReport, comparePopulations } from "@gbesse/jev-pulse";

const labeled = attachLabels(events, delayedLabels);
const report = buildReport(labeled, { threshold: 0.85, bins: 10 });
const drift = comparePopulations(lastWeek, thisWeek);
```

Pulse validates timestamps, latencies, confidence ranges and probability sums before computing a report. This prevents malformed telemetry from silently becoming a reassuring dashboard.

`comparePopulations` measures categorical total-variation distance and confidence shift between two windows. A shift is an alerting signal, not proof that quality changed.
