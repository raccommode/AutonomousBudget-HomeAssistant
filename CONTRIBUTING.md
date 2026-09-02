# Contributing

Code, documentation, and issues are written in English. The UI supports English and French; keep both translations up to date. Use fictional names and amounts in tests and screenshots.

## Setup

Use Python 3.14 and Node.js 22 or newer. [uv](https://docs.astral.sh/uv/) is convenient for creating the environment.

```bash
uv venv --python 3.14
uv pip install --python .venv/bin/python -r requirements-dev.txt
npm ci
npx playwright install chromium
```

## Checks

```bash
.venv/bin/ruff check custom_components tests scripts
.venv/bin/ruff format --check custom_components tests scripts
.venv/bin/pytest -q
npm run check
```

## Test inside Home Assistant

Start an isolated development instance in one terminal:

```bash
./scripts/dev.sh
```

In another terminal:

```bash
.venv/bin/python scripts/setup_demo.py
npm run test:e2e
```

The instance listens only on `127.0.0.1:8128`. The setup script onboards a disposable household, installs the integration through its real config flow, and seeds fictional budgets. It confirms the development HTTP settings after connecting successfully. It saves test credentials and tokens only under the ignored `.dev-ha` directory. Never reuse this script against a personal Home Assistant installation.

Browser tests authenticate using those local tokens. They exercise the real panel, websocket API, card registration, settings, recurring entries, currency conversion, pausing, persistence, and deletion. Screenshots are written to `docs/screenshot-*.png`; only intentionally reviewed screenshots belong in a commit.

The test instance may install Home Assistant's standard onboarding integrations. These are part of the disposable development household, not dependencies of Autonomous Budget.

## Structure

- `model.py`: validation, decimal amounts, anchored calendar periods, recurrence, projections.
- `planning.py`: pay-period normalization, next renewals, and projected reserve installments.
- `store.py`: Home Assistant storage, atomic writes, revision conflict checks, snapshots.
- `websocket.py`: authenticated subscriptions and administrator-only mutations.
- `sensor.py`: eleven native monetary sensors per budget, dynamic discovery and cleanup.
- `frontend/`: native web components for the panel and dashboard card; no build step. `i18n.js` translates UI text, while `translate="no"` protects every user-provided name.
- `translations/`: Home Assistant setup and entity translations in English and French.
- `tests/`: calendar, currency, storage, authorization, and browser regression coverage.

All runtime files must stay under `custom_components/autonomous_budget` so HACS can install them. Avoid remote runtime dependencies and avoid including financial entry names or amounts in logs.

## Changes and releases

Add tests when changing calendar behavior, monetary calculations, access checks, or persistence. Include desktop and mobile screenshots for UI changes. Keep the README and changelog aligned with actual behavior.

For a release, update the version in `manifest.json`, `const.py`, `package.json`, frontend module query strings / footer, and `CHANGELOG.md`. Run checks and publish a GitHub release with a matching `vX.Y.Z` tag. HACS installs files from the tagged repository structure; a generated ZIP is optional and is not required by this project.

CI runs unit tests, lint, JavaScript syntax checks, a real Home Assistant instance with browser tests, hassfest, and HACS validation. The HACS brands check is explicitly deferred until the integration has an accepted entry in `home-assistant/brands`. This repository is distributed as a custom repository rather than claiming default-catalog status.
