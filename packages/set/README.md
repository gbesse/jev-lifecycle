# @gbesse/jev-set

Calibrated multilabel selection for taxonomies where several labels may apply at once.

```bash
npm install @gbesse/jev-set
npx jev-set fit labeled-scores.jsonl --out thresholds.json
npx jev-set predict scores.json --model thresholds.json --constraints taxonomy.json
```

The fitter chooses one threshold per label on held-out scores using F-beta, with explicit behavior for sparse labels. The selector then applies optional parent relationships, mutually exclusive groups, and minimum/maximum cardinality. Cardinality limits apply to directly selected labels; implied taxonomy parents are added afterward and reported separately.

```ts
import { fitThresholds, selectLabels } from "@gbesse/jev-set";

const model = fitThresholds(trainingRows, {
  beta: 1,
  minimumSupport: 5,
  fallbackThreshold: 0.7,
});

const result = selectLabels(scores, model, {
  parents: { credential_phishing: "phishing" },
  exclusiveGroups: [["benign", "malicious"]],
  maxLabels: 5,
});
```

Input scores may come from one Noul per label, a compatible decision model, or another classifier. Thresholds are only as valid as the labeled population used to fit them. Keep a separate test set and refit when drift is detected.
