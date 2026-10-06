# Feature availability and provenance

WarEra Lab must distinguish **API/config exposure** from **production gameplay availability**.

> API presence proves data availability, not gameplay availability.

This is a lightweight correctness guardrail, not a complete feature-governance system.

## Minimal states

For mechanics that WarEra Lab is about to expose, explain, simulate, or recommend, gameplay availability is represented as one of:

- `production` — verified as currently available in production gameplay;
- `dev-not-production` — exposed in API/config or development environments, but not currently production-live;
- `unverified` — availability has not yet been established.

The record may also retain a short evidence note and a `checkedAt` date. No database or monitoring service is required.

## Evidence order

Prefer evidence in this order:

1. direct production-game observation and/or official release communication;
2. explicit production API feature flags when their semantics clearly represent gameplay availability;
3. official development/release notes;
4. community reports as a discovery signal that requires corroboration.

The mere presence of a field, enum, schema, configuration block, or observed API value is not enough to classify a mechanic as production-live.

## Current upgrade registry

The initial implementation is deliberately limited to company upgrades that are already used by WarEra Lab:

| Upgrade | API/config | Gameplay | Current treatment |
| --- | --- | --- | --- |
| Automated Engine | exposed | production | normal observed/plannable upgrade |
| Storage | exposed | production | normal observed/plannable upgrade |
| Break Room | exposed | dev-not-production | preserve observed API state, disclose dev status, disable hypothetical production planning |

Break Room is the first known case where production API/config exposure does not imply that the gameplay feature is currently available in the production game.

## Operating rule

Do not audit every WarEra feature in advance. Verify availability when a mechanic is about to enter a user-facing calculation, explanation, or recommendation.

If a mechanic is `dev-not-production` or `unverified`, WarEra Lab may still display useful observed/config context, but it must not silently present that mechanic as an ordinary production-live action or recommendation.

This guardrail is tracked by #69 and should be applied to Company Lab issue #48.
