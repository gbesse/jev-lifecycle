# Security policy

## Supported versions

Only the latest release receives security fixes while the project is in public alpha.

## Reporting

Use GitHub private vulnerability reporting for the repository. Do not include live API keys, customer state, unredacted traces, or production credentials in an issue.

## Boundaries

- These packages help test, observe, and route probabilistic decisions. They do not make a model correct.
- Authentication and authorization remain application responsibilities.
- Semantic safety checks are advisory. Deterministic permissions must remain in code.
- Raw state is excluded from telemetry by default. Enabling content capture can expose personal or confidential data.
- `.env` files are ignored and must never be committed.
