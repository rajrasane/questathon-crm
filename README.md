# Account Brief · Questathon CRM

A concise account workspace that separates evidence, reported claims, interpretations and unknowns. Built with React + TypeScript, Vite and a small Express server. No database or browser-held credential.

## Run locally

Requires Node 22+ and npm.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:3000`. Without a private snapshot the app displays its real unconfigured state, not demo customer data. `Refresh view` only reloads the server cache.

```sh
npm run lint
npm run typecheck
npm test
npm run build
NODE_ENV=production npm start
```

The server defaults to loopback. Set `HOST` and `PORT` only when configuring an authorized hosting runtime. No hosting registration, deployment or event submission is part of this repository workflow.

## Private evidence import

The upstream ingestion owner supplies a normalized snapshot matching `snapshotSchema` in `src/model.ts`. Keep all account records, research and identifiers outside this public repository.

```sh
CRM_DATA_DIR=/private/runtime/directory npx tsx server/import.ts /private/path/snapshot.json
CRM_DATA_DIR=/private/runtime/directory npm run dev
```

The importer validates the entire snapshot, rejects dangling source references and atomically replaces the private file. It does not print records. Default runtime storage is ignored `.private/`; set an external persistent directory for a deployed instance. Never put snapshots in `src/`, `public/` or `dist/`. Raw upstream formats are deliberately not guessed or automatically mapped.

Each source has a stable source ID, title, original locator, retrieval time and excerpt. Every non-unknown statement and known monetary value needs valid source references. Amounts distinguish booked value, pipeline value and projections. Conflicts are represented as two separate sourced statements. Action dates are explicitly proposed; unknown owners/dates remain null. Synthetic fixtures exist only inside the test suite.

## Upstream boundary

`server/adapter.ts` is a server-only transport with **no HTTP proxy route** and no registered tool schemas. Work remains the ingestion owner. The running app makes **zero upstream calls**, even if a runtime token exists.

Only after explicit ownership transfer, configure `AQ_TOKEN` through the runtime secret manager and `CRM_INGESTION_OWNER=this-process`. Never paste credentials in chat, source, shell arguments, browser variables, logs or Git. Verify exact upstream schemas before registering any `VerifiedTool`. All processes using the credential must share one persistent coordinator directory; separate machines require a shared coordinator service before use. External callers cannot share this local limiter, so ownership must be exclusive.

Every upstream attempt reserves 61 seconds on disk before network I/O. Concurrent calls fail closed; cooldown is preserved across restarts. Failed requests consume budget. Read responses are validated and cached durably; refresh is explicit. A crash leaving `upstream.lock` requires operator inspection before removal; never auto-expire a lock while a request may be active. The adapter allows only an explicitly initiated `write_note` when a verified write schema exists. There is no public note-writing route or UI yet.

## Current limits

The first build is a source-safe local implementation. Real account snapshots, exact upstream schemas and ingestion ownership transfer are pending. The UI does not infer missing people, IDs, values, outcomes or deadlines. Evidence older than 24 hours is marked stale; this is a review threshold, not a claim that the records have changed. Auth and hosted access decisions are deferred until deployment is authorized. The local API returns account summaries and selected excerpts, so only deploy after deciding who may read those records.

See [implementation guide](docs/IMPLEMENTATION_GUIDE.md) and [design decisions](docs/THINKING.md).
