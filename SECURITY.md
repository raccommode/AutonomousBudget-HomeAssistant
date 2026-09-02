# Security

## Supported versions

Security fixes target the latest release. Update through HACS and keep Home Assistant up to date.

## Reporting a vulnerability

Use GitHub's **Security → Report a vulnerability** on this repository for private disclosure. Include the affected version, a minimal reproduction, and the impact. Do not post tokens, Home Assistant backups, or real household financial data in public issues.

## Access model

Autonomous Budget relies on Home Assistant authentication. All authenticated users can read shared household budgets. Every mutation requires an administrator. The public static asset route serves frontend code only; budget data is delivered over authenticated Home Assistant websockets. There are no bank credentials or third-party API keys.
