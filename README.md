# Jev Lifecycle

[![CI](https://github.com/gbesse/jev-lifecycle/actions/workflows/ci.yml/badge.svg)](https://github.com/gbesse/jev-lifecycle/actions/workflows/ci.yml) ![Node](https://img.shields.io/badge/node-22%2B-339933) ![License](https://img.shields.io/badge/license-MIT-blue) ![Status](https://img.shields.io/badge/status-public_beta-blue)

Six production tools for Jev and compatible typed decision models:

| Package | Purpose |
| --- | --- |
| [`@gbesse/jev-shadow`](packages/shadow) | Compare a production decision path with a shadow Jev path without changing side effects. |
| [`@gbesse/jev-contractlab`](packages/contractlab) | Lint contracts and measure repeatability, option-order sensitivity, and argmax invariants. |
| [`@gbesse/jev-router`](packages/router) | Route bounded next steps hierarchically with provider failover, confidence gates, and loop detection. |
| [`@gbesse/jev-pulse`](packages/pulse) | Quantify calibration and recommend confidence policies from coverage, risk, and cost. |
| [`@gbesse/jev-triageops`](packages/triageops) | Run confidence-gated support triage with deterministic policy and a human review queue. |
| [`@gbesse/jev-set`](packages/set) | Fit calibrated multilabel thresholds with hierarchy and cardinality constraints. |

The suite is provider-neutral. Its JSON contracts can be used with TypeSafe Jev, a compatible gateway, recorded fixtures, or another decision backend. TypeSafe Jev is a hosted product of TypeSafe AI; this independent project is not affiliated with or endorsed by TypeSafe AI.

## Install

```bash
npm install @gbesse/jev-shadow @gbesse/jev-contractlab \
  @gbesse/jev-router @gbesse/jev-pulse @gbesse/jev-triageops @gbesse/jev-set
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
```

These commands make no network requests.

## Lifecycle

```text
contractlab -> shadow -> router/triageops -> pulse
                            \-> set
```

1. Make question contracts explicit and test their failure modes.
2. Stress repeatability with identical calls and option-order permutations.
3. Compare Jev with the existing production path in shadow mode.
4. Route only bounded outcomes and keep authorization deterministic.
5. Attach delayed labels, calibrate thresholds, and monitor drift.
6. Use calibrated multilabel selection when more than one category may apply.

## Development

```bash
npm install
npm run release:check
```

The default test suite is offline. Live requests must be explicitly configured and cost-capped by the caller.

## Security

Read [SECURITY.md](SECURITY.md) before processing untrusted or confidential content. Raw state and API keys are deliberately absent from normal reports and events.

## License

MIT.
