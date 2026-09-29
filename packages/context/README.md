# @gbesse/jev-context

Build an explainable Jev `state` under an explicit context budget. Entries are ranked by priority and relevance, required entries are protected, common sensitive strings are redacted, and every inclusion or exclusion is explained.

```ts
import { shapeContext } from "@gbesse/jev-context";

const shaped = shapeContext(entries, {
  totalTokenLimit: 32_000,
  reserveTokens: 4_096
});
```

```bash
jev-context shape entries.json --limit 32000 --reserve 4096
```

Token counts are conservative estimates and must not be represented as provider billing. Custom redaction rules should be added for domain-specific identifiers. Do not use `--no-redact` on untrusted or confidential material.
