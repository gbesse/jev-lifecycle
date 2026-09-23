# Contributing

Requires Node.js 22 or newer.

```bash
npm install
npm run release:check
```

Changes to request validation, probability handling, redaction, routing, or persistence require focused tests. Live Jev calls are never part of the default suite. Examples and tests must use synthetic data and fake credentials.

Keep deterministic operations in code. A model must not authorize actions, calculate dates or money, or silently turn a failed request into a successful decision.
