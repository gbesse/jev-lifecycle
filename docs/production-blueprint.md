# Production blueprint

The packages are designed as small boundaries rather than a single framework. Adopt only the stages your application needs.

```text
untrusted application state
        |
        v
  jev-context       select, reserve, redact, fingerprint
        |
        v
  jev-runtime       canonicalize, reject unsafe JSON, budget, timeout, retry
        |
        +----------> jev-vision (when the evidence is visual)
        |
        v
  provider adapter  TypeSafe Jev, compatible gateway, or local model
        |
        +----------> jev-conformance (recorded evaluation observations)
        |
        v
  deterministic application policy
        |
        +----------> jev-receipts (integrity and provenance)
        |
        +----------> shadow / router / triageops / set / pulse
```

## Trust boundaries

- A model proposes a bounded decision; it does not grant permission.
- `jev-context` redaction reduces accidental disclosure but is not a data-loss-prevention system.
- `jev-runtime` token estimates are conservative heuristics, not provider billing records.
- A conformance report is meaningful only when providers receive equivalent requests and generation settings.
- A valid receipt proves that its body was signed by a key. It does not prove that the key holder was authorized or that the decision was correct.
- Visual inputs can be fetched by a remote provider. Do not send confidential media to an endpoint you do not control.

## Recommended rollout

1. Run ContractLab and Conformance on redacted fixtures.
2. Add Context and Runtime in observe-only mode and compare their budgets with provider usage.
3. Use Shadow before changing a production decision path.
4. Keep authorization, financial limits, and irreversible actions in deterministic code.
5. Add Receipts only after defining key rotation, retention, and authority semantics.

## Secret handling

The suite never searches for or automatically loads credentials. Pass secrets directly to the provider adapter at runtime, keep `.env` ignored, and ensure local key files have restrictive permissions. CLI reports deliberately omit environment variables, raw credentials, and private signing material.
