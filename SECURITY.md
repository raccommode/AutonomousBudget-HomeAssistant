# Security

## Supported versions

Security fixes target the latest release. Update through HACS and keep Home Assistant up to date.

## Reporting a vulnerability

Use GitHub's **Security → Report a vulnerability** on this repository for private disclosure. Include the affected version, a minimal reproduction, and the impact. Do not post tokens, Home Assistant backups, or real household financial data in public issues.

## Access model

Autonomous Budget uses Home Assistant authentication. Legacy unlinked budgets are readable by household users and editable by administrators. Financial accounts are private by default; server-side Read/Edit checks cover transactions, reports, exports, subscriptions and connections. Linked budgets inherit the intersection of source-account audiences. Currency pockets follow their portfolio's current permissions.

The static route serves frontend code only. Financial data uses authenticated WebSocket or HTTP endpoints. Private cards query as the viewer. New native account sensors require explicit owner publication because Home Assistant entity states do not provide this application's per-account privacy. Unpublishing cannot erase prior Recorder history or backups.

Lunch Flow keys remain on the server and are omitted from responses, audit payloads and application JSON exports. A normal Home Assistant backup can contain these credentials. The server administrator, filesystem and server backups are outside the application privacy boundary. Only enabled/invoked external providers are contacted. Imports are parsed without XML entity expansion and restored data is validated before atomic commit.
