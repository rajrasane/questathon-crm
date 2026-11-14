# Vercel deployment plan

Status: implementation prepared on `feat/submission-ready`; see [hosted setup](HOSTED_SETUP.md) for the current adapter and acceptance steps. Production provisioning and validation remain pending. The historical plan below records the original migration scope. No Vercel project, storage, schedule or deployment has been created by this coding task. Provisioning and deployment remain paused pending confirmation in the main conversation after the reported automatic-approval rejection. The laptop remains the sole MCP caller. Final submission remains outside this step.

## Target layout

Keep the existing React interface and validated account model. Build the client with Vite and serve its assets on Vercel. Expose a Vercel Node function at `/api/workspace` that reads a validated snapshot from private persistent storage. Replace filesystem-based private state with a storage adapter; do not point `CRM_DATA_DIR` at `/tmp` and claim it is durable.

Use one Redis-compatible store accessible over authenticated HTTPS for snapshots, source records, normalized rows, event versions, poll status and the shared rate coordinator. Upstash Redis is a candidate because it exposes an HTTP REST API suitable for serverless functions. Availability, limits and cost must be checked in the actual account before creation. No paid plan or automatic upgrade is authorized by this plan.

Store all credentials as server runtime secrets: upstream credential, database URL/token and a distinct trigger secret. None belongs in the browser, build output, repository, deployment URL or logs. Fetch the initial baseline through MCP after the runtime ownership handover and store it privately; never commit it or expose an anonymous upload/proxy endpoint.

## Changes required before deployment

1. Introduce a storage interface with filesystem and Redis implementations. The local workflow continues to use the existing filesystem implementation.
2. Refactor the MCP adapter to accept a coordinator implementation. The Redis coordinator atomically reserves a 61-second request slot before network I/O and uses a separate ownership lock for read/merge/write. Rate reservations survive failed calls; concurrent workers fail closed. Never use one local lock per Vercel instance.
3. Add serverless workspace and authenticated ingestion handlers. Workspace reads never call arbitrary upstream tools. The ingestion function only checks verified read-only signals, merges stable event/row keys, runs deterministic analysis and publishes the validated snapshot atomically. No note writes.
4. Preserve version history and provenance when records change. Identical responses remain no-ops. Changed signals update evidence and usage analysis and flag editorial actions for review. Do not claim that flagging is automatic rewriting of the ranked action plan.
5. Configure a supported trigger. Do not run `setInterval` or `setTimeout` as a persistent Vercel poller. The current account is Hobby, whose legacy Cron Jobs permit only daily execution. A separately approved scheduler or plan change is needed for unattended frequent polling. Browser-request-driven refresh is a possible limited fallback, but it stops when nobody visits and must be described accurately.

## Order of operations after confirmation

- Select and approve the storage/trigger combination and any cost before provisioning.
- Implement and test both storage adapters and the serverless handlers locally using synthetic fixtures.
- Create or reuse exactly one Vercel project connected to the feature branch. Configure secrets through the signed-in session. Do not create a duplicate of the unrelated existing Sites project.
- Deploy with hosted MCP ingestion disabled; migrate the existing private cache through a secured administrative path or initialize it through MCP only after the handover. Confirm the populated workspace is viewable in a private browser window and that raw files, credentials and write routes cannot be accessed.
- Stop the laptop poller and receive explicit acknowledgement. Record its final request time, then wait at least 61 seconds after completion before activating the hosted owner. Exactly one runtime may call MCP.
- Perform one read-only signal check through the global coordinator. Verify success status, stable record counts and no duplicate ledger entries. Activate the approved periodic trigger only after this check.
- Keep final event submission separate. Return the actual verified URL and remaining limitations.

## Acceptance evidence

Local tests must demonstrate cross-instance rate reservation, failed-request budget consumption, idempotent merges, atomic publication, null/currency handling, provenance validation and credential exclusion. Hosted checks must show both populated accounts, evidence navigation, safe access in a private browser window, persistence across cold starts, a real successful signal read, and a subsequent data update without redeploy. Synthetic changed-signal tests supplement but do not establish observation of a newly arriving live signal.

The existing thinking document and a three-minute walkthrough still need final review/recording after hosted behavior is verified.

## Sources

- Vercel Functions runtimes document a read-only filesystem with writable temporary scratch space: https://vercel.com/docs/functions/runtimes
- Vercel legacy Cron Jobs usage documentation states Hobby's once-daily minimum interval: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Upstash documents Redis access through authenticated HTTPS: https://upstash.com/docs/redis/features/restapi
