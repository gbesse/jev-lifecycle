# @gbesse/jev-pulse

Offline and CI-friendly decision observability. Pulse joins delayed labels to privacy-safe decision events, then reports accuracy, Brier score, ECE, high-confidence errors, confidence-gated coverage, selective accuracy, latency, token usage, model splits and business slices.

```bash
npm install @gbesse/jev-pulse
npx jev-pulse events.jsonl \
  --labels labels.jsonl \
  --threshold 0.8 \
  --out report.json \
  --html report.html

npx jev-pulse calibrate events.jsonl \
  --labels labels.jsonl \
  --target-accuracy 0.95 \
  --min-coverage 0.20 \
  --out threshold-policy.json
```

Events contain decision metadata, not raw state. Labels can arrive later under the same event id. Missing labels remain unknown and are never counted as errors or successes.

```ts
import { attachLabels, buildReport, comparePopulations, recommendThreshold } from "@gbesse/jev-pulse";

const labeled = attachLabels(events, delayedLabels);
const report = buildReport(labeled, { threshold: 0.85, bins: 10 });
const drift = comparePopulations(lastWeek, thisWeek);
const policy = recommendThreshold(labeled, {
  targetAccuracy: 0.95,
  minCoverage: 0.2,
  confidenceMode: "wilson",
  costs: { review: 1, falseAccept: 20 },
});
```

Pulse validates timestamps, latencies, confidence ranges and probability sums before computing a report. This prevents malformed telemetry from silently becoming a reassuring dashboard.

`comparePopulations` measures categorical total-variation distance and confidence shift between two windows. A shift is an alerting signal, not proof that quality changed.

Threshold calibration sweeps the complete coverage/accuracy/cost frontier. By default it uses a 95% Wilson lower bound rather than the optimistic point estimate, and subtracts half of a 0.01 probability step before accepting an event. These defaults make small samples and two-decimal probability rounding visible instead of silently overstating safety. Use `--observed-accuracy` or `--raw-confidence` only when that trade-off is intentional.

No recommendation is returned when the constraints are unsupported by the labeled sample. A threshold is a review policy input, never an authorization rule.
