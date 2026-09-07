# Security

## Supported versions

Security fixes target the latest release. Update through HACS and keep Home Assistant up to date.

## Reporting a vulnerability

Use GitHub's **Security → Report a vulnerability** on this repository for private disclosure. Include the affected version, a minimal reproduction, and the impact. Do not post tokens, Home Assistant backups, or real household financial data in public issues.

## Access model

Autonomous Budget uses Home Assistant authentication. All authenticated Home Assistant users can read and edit household financial data, including accounts, budgets, transactions, portfolios, reports, exports and existing connections. Optional account assignment is informational and never an access restriction. This applies to existing records as well as new ones. Server-side checks reserve creation of accounts, budgets, connections and other financial setup records, plus backup restoration, for Home Assistant administrators. Members can record transactions and modify existing records. Personal display preferences remain per user.

The static route serves frontend code only. Financial data uses authenticated WebSocket or HTTP endpoints. Financial cards use the authenticated viewer and show household data. Native account sensors require explicit publication before amounts appear in Home Assistant entity states. Unpublishing cannot erase prior Recorder history or backups.

Lunch Flow keys remain on the server and are omitted from responses, audit payloads and application JSON exports. A normal Home Assistant backup can contain these credentials. The server administrator, filesystem and server backups are outside the application privacy boundary. Only enabled/invoked external providers are contacted. Imports are parsed without XML entity expansion and restored data is validated before atomic commit.
