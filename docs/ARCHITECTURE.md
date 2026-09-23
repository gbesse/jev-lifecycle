# Architecture

Jev Lifecycle treats a model answer as evidence for a bounded decision, never as authorization.

## Shared event envelope

Packages exchange JSON objects with stable identifiers, timestamps, pinned model identifiers, question fingerprints, distributions, latency, token usage, and optional labels. Raw input is excluded by default. Events may be appended as JSONL for simple deployments or forwarded to an external store.

## Failure behavior

- malformed responses fail closed;
- absent labels are represented as unknown, not incorrect;
- numerical values must be finite and probabilities must stay in `[0, 1]`;
- no retry fabricates a response;
- shadow failures do not affect the primary response;
- triage uncertainty routes to review;
- policy and threshold versions are recorded with every decision.

## Package boundaries

- ContractLab owns static checks, deterministic mutations, and comparison reports.
- Shadow owns concurrent primary/shadow execution and disagreement events.
- Pulse owns aggregate metrics and distribution-shift detection.
- Set owns threshold fitting and constrained multilabel selection.
- TriageOps owns a bounded support-ticket policy and review queue.
