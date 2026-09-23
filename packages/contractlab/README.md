# @gbesse/jev-contractlab

Tests for semantic decision contracts: static linting, stable fingerprints, deterministic adversarial mutations, and response regression diffs.

```bash
npm install @gbesse/jev-contractlab
npx jev-contract lint contract.json
npx jev-contract mutate state.json
npx jev-contract compare baseline.json candidate.json
```

ContractLab catches common Jev failure modes before a live call: arithmetic or date logic in a question, moving model aliases, missing abstention options, inverted Noul criteria, invalid primitive sizes, and authorization delegated to a model.

```ts
import { fingerprint, generateMutations, lintContract, compareResponses } from "@gbesse/jev-contractlab";

const issues = lintContract(contract);
const id = fingerprint(contract);
const cases = generateMutations(state);
const diffs = compareResponses(baseline, candidate, 0.05);
```

The fingerprint uses canonical JSON, so object key order does not create a new contract version. Comparison validates probability distributions and reports decision, confidence and probability drift per question.

The mutation command creates meaning-preserving key-order and whitespace variants plus an irrelevant distractor. Execute them with your chosen provider, then compare responses. It does not claim that passing these tests proves correctness.

See the repository root for security policy and license.
