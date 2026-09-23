# @gbesse/jev-triageops

Confidence-gated support triage with deterministic business policy, shadow mode, privacy-safe receipts and an append-only human review queue.

```bash
npm install @gbesse/jev-triageops
npx jev-triageops check --config policy.json
node --env-file=.env node_modules/.bin/jev-triageops serve --config policy.json
```

The server exposes:

- `POST /v1/triage` — evaluate one normalized support ticket;
- `GET /v1/reviews` — list pending and resolved review records;
- `POST /v1/reviews/:id/resolve` — approve, reject, or correct a proposal;
- `GET /health` — readiness and current mode.

Start policies in `shadow` mode. In `active` mode, only sufficiently confident, bounded routes are marked committed. High-value refunds, abusive content, low confidence, and an explicit review choice always go to the human queue.

A policy owns the fixed team vocabulary and operational thresholds:

```json
{
  "version": 1,
  "name": "support-v1",
  "model": "jev-1.13.0",
  "mode": "shadow",
  "teams": {
    "billing": "Payments, charges, invoices, refunds",
    "technical": "Bugs, outages, integrations",
    "review": "Insufficient evidence or exceptional handling"
  },
  "minTeamConfidence": 0.8,
  "minUrgencyConfidence": 0.7,
  "highValueAmount": 250,
  "staleAfterHours": 48,
  "reviewTeam": "review"
}
```

Set `TRIAGE_TOKEN` to require bearer authentication on every endpoint except `/health`. The service listens on loopback only. The JSONL review store is intended for one service process; use a transactional database adapter before horizontal scaling.

Dates, age, SLA-style staleness and amount thresholds are computed in code. Jev receives the derived facts but never performs the arithmetic. Receipts contain hashes and decisions, not ticket text.
