# Jev Lifecycle

[![CI](https://github.com/gbesse/jev-lifecycle/actions/workflows/ci.yml/badge.svg)](https://github.com/gbesse/jev-lifecycle/actions/workflows/ci.yml) ![Node](https://img.shields.io/badge/node-22%2B-339933) ![License](https://img.shields.io/badge/license-MIT-blue) ![Status](https://img.shields.io/badge/status-public_beta-blue)

Eleven production tools for Jev and compatible typed decision models:

| Package | Purpose |
| --- | --- |
| [`@gbesse/jev-shadow`](packages/shadow) | Compare a production decision path with a shadow Jev path without changing side effects. |
| [`@gbesse/jev-contractlab`](packages/contractlab) | Lint contracts and measure repeatability, option-order sensitivity, and argmax invariants. |
| [`@gbesse/jev-router`](packages/router) | Route bounded next steps hierarchically with provider failover, confidence gates, and loop detection. |
| [`@gbesse/jev-pulse`](packages/pulse) | Quantify calibration and recommend confidence policies from coverage, risk, and cost. |
| [`@gbesse/jev-triageops`](packages/triageops) | Run confidence-gated support triage with deterministic policy and a human review queue. |
| [`@gbesse/jev-set`](packages/set) | Fit calibrated multilabel thresholds with hierarchy and cardinality constraints. |
| [`@gbesse/jev-runtime`](packages/runtime) | Fail fast on unsafe payloads, estimate request budgets, and execute with bounded timeout and retry policies. |
| [`@gbesse/jev-conformance`](packages/conformance) | Compare protocol validity, quality, repeatability, latency, and recorded cost across decision engines. |
| [`@gbesse/jev-context`](packages/context) | Shape privacy-aware state under a conservative context budget with an explanation for every item. |
| [`@gbesse/jev-receipts`](packages/receipts) | Produce tamper-evident SHA-256 and Ed25519 decision receipts without embedding raw inputs. |
| [`@gbesse/jev-vision`](packages/vision) | Normalize typed decisions over screenshots, images, and video-capable providers. |

The suite is provider-neutral. Its JSON contracts can be used with TypeSafe Jev, a compatible gateway, recorded fixtures, or another decision backend. TypeSafe Jev is a hosted product of TypeSafe AI; this independent project is not affiliated with or endorsed by TypeSafe AI.

## Install

```bash
npm install @gbesse/jev-shadow @gbesse/jev-contractlab \
  @gbesse/jev-router @gbesse/jev-pulse @gbesse/jev-triageops @gbesse/jev-set \
  @gbesse/jev-runtime @gbesse/jev-conformance @gbesse/jev-context \
  @gbesse/jev-receipts @gbesse/jev-vision
```

Each package has a programmatic API, a focused CLI, offline examples, and tests. No package sends telemetry to the maintainer.

## Offline tour

```bash
npm install
npm run build

node packages/contractlab/dist/cli.js lint examples/contract.json
node packages/router/dist/cli.js check --config examples/router-config.json
node packages/pulse/dist/cli.js examples/pulse-events.jsonl \
  --labels examples/pulse-labels.jsonl --html output/pulse.html
node packages/set/dist/cli.js fit examples/set-dataset.jsonl \
  --out output/set-model.json
node packages/triageops/dist/cli.js check --config examples/triage-policy.json
node packages/runtime/dist/cli.js inspect examples/runtime-request.json
node packages/context/dist/cli.js shape examples/context-entries.json
node packages/conformance/dist/cli.js report examples/conformance-cases.json examples/conformance-observations.jsonl
node packages/vision/dist/cli.js validate examples/vision-request.json
```

These commands make no network requests.

## Lifecycle

```text
context -> runtime -> shadow -> router/triageops -> pulse
             |               \-> set
             +-> conformance
             +-> vision
             \-> receipts
```

1. Make question contracts explicit and test their failure modes.
2. Stress repeatability with identical calls and option-order permutations.
3. Compare Jev with the existing production path in shadow mode.
4. Route only bounded outcomes and keep authorization deterministic.
5. Attach delayed labels, calibrate thresholds, and monitor drift.
6. Use calibrated multilabel selection when more than one category may apply.
7. Preflight exact wire payloads, bound provider execution, and preserve request fingerprints.
8. Compare compatible engines using normalized, replayable observations.
9. Sign privacy-preserving receipts when decisions require durable provenance.

## Development

```bash
npm install
npm run release:check
```

The default test suite is offline. Live requests must be explicitly configured and cost-capped by the caller.

## Security

Read [SECURITY.md](SECURITY.md) before processing untrusted or confidential content. Raw state and API keys are deliberately absent from normal reports and events.

See the [production blueprint](docs/production-blueprint.md) for package composition and trust boundaries.

## License

MIT.
