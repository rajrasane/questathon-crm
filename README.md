# Account Brief · Questathon CRM

An evidence-backed CRM for account situations, individual deals, stakeholder authority, ranked actions, risks and consequential unknowns. React + TypeScript, Vite and a small Express server. Account records and credentials stay outside this public repository.

## Start locally

Requires Node 22.9+ and npm. Stop any other runtime using the same MCP token before enabling ingestion.

```sh
npm ci
npm run setup
```

Open the newly created `.env.local` in your editor and set `AQ_TOKEN` to your token. Keep `CRM_INGESTION_OWNER=this-process` only on the selected runtime. Then:

```sh
npm run dev
```

Open **http://localhost:3000**. No JSON download or import is needed.

`.env.local` is ignored by Git, denied by the dev file server and created with owner-only permissions. The setup command never overwrites an existing file. The token is read only by the Node server and never exposed to Vite client variables. Do not use a `VITE_` prefix or commit the token. An optional `npm run live` launcher also supports hidden terminal entry if the environment file has no token.

## First fetch, then cache

After a 65-second handover safety delay, the sole server runtime fetches the discovery export. Subsequent cycles fetch each account's bulk paperwork and each referenced file once. Every attempt reserves the same persistent 61-second upstream budget before network I/O, including failures. Initial loading takes several minutes and publishes partial validated records as they arrive.

Fetched records, snapshots, row merges and event history are stored in ignored `.private/`, or the external persistent directory selected by `CRM_DATA_DIR`. Restarts reuse the cache and resume missing fetches. Once the baseline is complete, the server checks `get_signals` every 65 seconds. Browser refreshes read only the local snapshot and do not consume upstream requests.

```sh
npm run live:status
```

The status command reports the last successful signal check. During baseline fetching it may have no signal-check timestamp yet. A timestamp does not prove the server process is still running; keep the server terminal open. A missing credential or unavailable upstream leaves the app in an honest waiting/partial/error state, never a demo-data fallback.

Existing validated caches continue to work. Startup regenerates outdated analysis from those records without a network call. Legacy private analysis files are neither used nor deleted.

## Interpretation and updates

Every factual statement needs resolvable source evidence. Claims, told/reported statements, verified records and interpretations retain distinct labels. Existing annual contract value is separate from new booked value. Missing monetary values remain unknown; missing currencies are never assumed. Open, declined or won offers do not automatically count as revenue.

Signals merge by original account/event ID; usage by account + week_start + dock_id; requests by account + request_id. Unidentified requests receive explicitly local deterministic keys. Repeated content is a no-op. New content automatically regenerates stakeholder assessments, ranked actions, risks, unknowns and supported contradictions. Closing a request removes it from the proposed action list. No manual analysis file is required.

The deterministic analysis rules treat historical signatories, billing recipients and operational contacts as evidence to investigate, not proof of current authority. They prioritize urgent requests, succession gaps, sustained usage stoppages, commercial requests and documented evidence conflicts. Owners and dates are proposals; unknown authority, unrecorded deadlines and missing value remain unknown. The rules only recognize explicitly supported patterns and do not claim exhaustive interpretation of every document. See [analysis behavior](docs/ANALYSIS.md).

Known source retrieval times, local cache timestamps and simulated scenario dates remain separate. Future scenario dates are allowed. A local cache rebuild does not claim a fresh upstream fetch.

## Checks

```sh
npm run lint
npm run typecheck
npm run build
npm test
```

Tests use isolated synthetic records and mocked MCP responses, including empty-cache initialization, restart/resume, provenance, null values, transport decoding, cooldowns, concurrency, idempotent updates and private HTTP boundaries. Build first to include the browser-bundle exclusion check.

Production Node start:

```sh
NODE_ENV=production npm start
```

Use one persistent coordinator directory across every process sharing a token. Multiple hosts require external shared coordination before use. Crash-leftover locks fail closed and require operator review. No public proxy, note-write route or automatic note writer is provided.

The [hosted application](https://questathon-crm-blue.vercel.app) runs the `feat/submission-ready` implementation on Vercel with private Redis persistence and a protected QStash trigger every two minutes. Production owns MCP ingestion; do not also start a laptop poller with the same token. Initial records are fetched through MCP, and the browser reads only the cached workspace. Free plans are configured with zero scheduler retries and Redis automatic upgrades disabled.

See [hosted setup](docs/HOSTED_SETUP.md), the [historical deployment plan](docs/VERCEL_PLAN.md), [data contract](docs/DATA_CONTRACT.md), [thinking document](docs/THINKING.md), and [walkthrough script](docs/WALKTHROUGH.md). Final event submission requires the owner's review.
