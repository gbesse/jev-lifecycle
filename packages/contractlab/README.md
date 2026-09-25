# @gbesse/jev-contractlab

Tests for semantic decision contracts: static linting, stable fingerprints, deterministic adversarial mutations, response regression diffs, and repeatability under pressure.

```bash
npm install @gbesse/jev-contractlab
npx jev-contract lint contract.json
npx jev-contract mutate state.json
npx jev-contract compare baseline.json candidate.json
npx jev-contract stability observations.json --tolerance 0.011
```

ContractLab catches common Jev failure modes before a live call: arithmetic or date logic in a question, moving model aliases, missing abstention options, inverted Noul criteria, invalid primitive sizes, and authorization delegated to a model.

```ts
import { fingerprint, generateMutations, lintContract, compareResponses, runStabilityLab } from "@gbesse/jev-contractlab";

const issues = lintContract(contract);
const id = fingerprint(contract);
const cases = generateMutations(state);
const diffs = compareResponses(baseline, candidate, 0.05);
const { observations, report } = await runStabilityLab(contract, state, provider, {
  repetitions: 5,
  permutations: 10,
  seed: 42,
});
```

The fingerprint uses canonical JSON, so object key order does not create a new contract version. Comparison validates probability distributions and reports decision, confidence and probability drift per question.

The mutation command creates meaning-preserving key-order and whitespace variants plus an irrelevant distractor. Execute them with your chosen provider, then compare responses. It does not claim that passing these tests proves correctness.

The stability lab repeats the unchanged request and deterministic option-order permutations. It reports fixed-order flip rate, permutation flip rate, consensus, maximum probability movement, and both strict and rounding-tolerant `choice`/`argmax` mismatches. The provider is injected, so the same harness works with hosted Jev, a local gateway, or recorded fixtures. Runs are sequential by design, which makes rate limiting and incident reproduction predictable.

`jev-contract stability` analyzes saved observations without a network call. It exits with status 2 when any material instability is found, making it suitable for CI gates.

See the repository root for security policy and license.
