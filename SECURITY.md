# Security Policy

WarEra Lab is at an early project stage, but security-sensitive reports should still be handled privately.

## Reporting a vulnerability

Do **not** publish exploit details, credentials, API keys, tokens, or private user data in a public GitHub issue.

If GitHub private vulnerability reporting is available for this repository, use the repository's **Security** area to submit the report privately.

If private reporting is not yet available, open a minimal public issue titled **Security contact requested** without vulnerability details. A maintainer can then arrange a private follow-up channel.

## Scope

Security concerns may include, among other things:

- accidental exposure or persistence of WarEra API credentials;
- cross-site scripting or injection issues;
- insecure handling of imported player/account data;
- cache poisoning or cross-user data leakage;
- abuse of backend proxy endpoints;
- authorization or access-control failures;
- exposure of ROCSI production secrets or infrastructure details.

## Credentials

No production credential belongs in the repository, issue tracker, pull-request discussion, screenshots, fixtures, or logs.

Any future feature that accepts a WarEra API key must document where that key is processed, stored, transmitted, and excluded from telemetry, logs, shared scenarios, and exports.

## Supported versions

There is no production release yet. A formal supported-version policy will be added before or with the first public deployment.
