# Account Brief · Questathon CRM

An evidence-backed account workspace built with React, TypeScript, Vite and a small Express server. It separates claims, told/reported statements, verified evidence, interpretations and unknowns. Private records never belong in this public repository.

## Run locally

Requires Node 22+ and npm.

```sh
git switch feat/account-brief
npm ci
npm run dev
```

Open **http://127.0.0.1:3000**. Without imported private data, the app displays `Sources pending`. The browser refreshes its server cache every 15 seconds; browser tabs never call MCP.

## Load your private handoff

Download the separately supplied private runtime JSON to your computer, then run:

```sh
npx tsx server/import-bundle.ts /absolute/path/to/questathon-runtime.json
```

The importer supports the original raw bundle and a prepared `{bundle, analysis}` runtime package. The prepared package includes the reviewed account brief, proposed actions and contradictions; a raw bundle alone shows source-backed discovery and explicit analysis gaps. Private state goes into ignored `.private/`. You can use an external directory via `CRM_DATA_DIR` on both import and server commands.

The app updates from disk on refresh; no rebuild is needed. Stop and restart the dev process after pulling server-code changes. Do not put a private file into `src/`, `public/`, `dist/` or any tracked directory. No credential is needed to preview a private cached import.

The normalized-snapshot importer remains available for custom integrations:

```sh
npx tsx server/import.ts /absolute/private/path/snapshot.json
```

See [private import contract](docs/IMPORT_CONTRACT.md) for the presentation schema and source mapping.

## Checks and production build

```sh
npm run lint
npm run typecheck
npm run build
npm test
NODE_ENV=production npm start
```

Tests use synthetic data and mocked upstream responses. Tests cover provenance, null amounts, currency uncertainty, claims, deal/offer separation, stale/error states, private HTTP boundaries, JSON/SSE transport, idempotent ingestion, CSV merges, update review flags, concurrency and rate limiting. Build before testing to include the browser-bundle exclusion check.

The server defaults to loopback. Configure `HOST`, `PORT` and persistent private storage only for an authorized hosting runtime. Runtime `tsx` is currently supplied by the normal development dependency installation; do not install with `--omit=dev` for this start command.

## Live signal ownership

**Live polling is disabled by default.** Work remains the upstream ingestion owner until explicit transfer. Private import is not a live MCP connection.

After exclusive ownership is transferred, configure `AQ_TOKEN` in a server runtime secret manager and `CRM_INGESTION_OWNER=this-process`. Never put a token in chat, command arguments, Git, logs or a frontend-prefixed variable. The private bundle must contain the verified `get_signals` tool declaration. Only then does the server schedule one signal check every 65 seconds. No note writes are scheduled or exposed.

All callers with the token must share the same persistent coordinator directory. Local filesystem locks protect multiple processes on one shared filesystem; multiple hosts need an external coordinator before use. Failed requests reserve the same 61-second budget. A leftover lock after a crash requires operator review; it is never expired automatically.

Signals merge by account and original signal ID. Usage rows merge by account + week_start + dock_id; requests by account + request_id, with deterministic local keys for requests lacking an ID. Source provenance is retained. Repeated content does not rewrite the snapshot or duplicate rows. Changed content updates the event ledger, current signals and deterministic usage analysis; the reviewed editorial brief is flagged for reconsideration. This does not silently invent a new customer commitment or automatically rewrite human-reviewed actions.

JSON-RPC text content is decoded before schema validation. Both JSON and SSE responses are supported. The transport has no browser proxy route. The HTTP API is read-only; private files and server source paths are blocked.

## Interpretation boundaries

Existing annual contract value is renewal exposure, separate from new booked value. No open, declined or won offer automatically becomes revenue. Missing currencies stay missing. Account-level offers are not assigned to deals without a source link.

Scenario dates, discovery-export dates, import times and unknown source retrieval times remain separate. Future scenario dates are allowed. A local import does not claim to be a fresh upstream retrieval. Source older-than-one-day warnings use known retrieval times and cache age; missing retrieval metadata remains explicitly unknown.

Hosting, access control, a walkthrough recording and final event submission remain separate steps. The local API exposes selected private evidence to anyone allowed to reach that server; decide authorized readership before deploying. See [thinking document](docs/THINKING.md) for the design rationale.

## Start live mode on your laptop

Stop the current dev server and ensure Work has stopped all MCP requests. Then run:

```sh
npm run live
```

The launcher requires explicit confirmation that every other caller has stopped, then accepts the token through hidden terminal input. The token is passed only to the server process environment; it is not written to a file or shell history. After the initial 65-second cooldown, the server checks signals on the shared rate budget. Keep this terminal running. In another terminal:

```sh
npm run live:status
```

A successful check timestamp is evidence that a real check completed. A prior check record alone does not prove that the server is currently running. Keep this local process as the sole caller until an explicit later handover. Stopping the server ends this process's polling.
