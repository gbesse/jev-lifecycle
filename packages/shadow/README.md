# @gbesse/jev-shadow

Compare a primary typed-decision provider with a shadow provider without letting the shadow path control production side effects.

```bash
npm install @gbesse/jev-shadow

PRIMARY_URL=https://primary.example/v1/systemone \
SHADOW_URL=https://api.typesafe.ai/v1/systemone \
SHADOW_TOKEN=... \
npx jev-shadow
```

Send System One-compatible requests to `http://127.0.0.1:4319/v1/systemone`. The primary response is returned as soon as it completes. The shadow comparison continues independently and appends privacy-safe JSONL events containing hashes, model ids, latency, agreement and decision diffs—never raw state or credentials.

The programmatic `runShadow` API also accepts arbitrary adapters that normalize an existing classifier and Jev into `DecisionEnvelope` objects.

```ts
const { primary: answer, comparison } = await runShadow(input, currentProvider, jevProvider, {
  traceId: request.id,
  sampleRate: 0.1,
  timeoutMs: 5_000,
  onEvent: eventStore.append,
});

return answer.raw;          // production path
await comparison;           // analytics path; never controls the response
```

Environment variables for the bundled proxy:

| Variable | Meaning |
| --- | --- |
| `PRIMARY_URL` / `PRIMARY_TOKEN` | Current System One-compatible provider. |
| `SHADOW_URL` / `SHADOW_TOKEN` | Candidate provider. |
| `SHADOW_PROXY_TOKEN` | Optional inbound bearer token. |
| `SHADOW_SAMPLE_RATE` | Stable trace-id sampling from `0` to `1`. |
| `SHADOW_EVENT_PATH` | Append-only comparison JSONL path. |
| `PORT` | Loopback port, default `4319`. |

Numeric decisions agree within `0.05` by default; categorical decisions must match exactly. Programmatic callers can choose another numeric tolerance.

Shadow mode proves disagreement rates, not correctness. Attach real labels and analyze the events with `@gbesse/jev-pulse` before routing production actions through a new provider.
