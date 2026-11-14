# Hosted runtime setup

The `feat/submission-ready` branch includes Vercel Node handlers and a Redis REST storage adapter. No resource creation, paid upgrade, hosted MCP ownership or final submission is implicit in these source files.

## Runtime configuration

Create one Vercel project from this repository, using Vite, build `npm run build`, output `dist`. The root `api/workspace.ts` is read-only. The authenticated `api/ingest.ts` performs at most one verified tool call per invocation. No private data or `.env.local` belongs in the build.

Production-only secrets:

- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: private persistent Redis REST connection.
- `CRON_SECRET`: a new random scheduler credential, unrelated to the MCP token.
- `AQ_TOKEN`: upstream credential, configured privately by the owner.
- `CRM_INGESTION_OWNER`: leave unset until the laptop has stopped; set to `hosted` only after handover.

Keep ingestion disabled in preview deployments. Do not configure identical ownership in preview and production. Redis keys use one `{questathon}` namespace so production workers share one budget. Separate previews must not poll the same token with another database or namespace.

Configure one scheduler to invoke `/api/ingest` with `Authorization: Bearer <CRON_SECRET>`. Never put the secret in the URL. Select a supported plan/frequency before provisioning; a two-minute external trigger is sufficient for the 61-second minimum gap, but provider quotas, retries and cost must be checked in the actual account. There is no persistent timer or default cron in the Vercel build.

## Coordination and storage

Redis Lua acquires a 90-second lease and 61-second cooldown atomically before network I/O. Failed upstream calls keep the cooldown. A fenced publication checks lease ownership before replacing one state document containing the bundle, validated snapshot, event versions and status. Old workers cannot replace newer state. Source credentials are never stored in that document. The API returns the normalized snapshot, not the raw cache bundle.

Initial setup fetches the discovery export, each account's paperwork and referenced files once, one resource per invocation. Subsequent calls fetch signals. Restarted functions reuse Redis state. Repeated signals preserve snapshot generation time; changed input regenerates analysis and retains event versions. Invalid responses preserve the last validated snapshot.

## Acceptance and handover

1. Provision approved storage and scheduler without paid upgrades. Deploy with hosted ingestion disabled.
2. Configure secrets privately. Never copy credentials into chat, Git, logs or the browser bundle.
3. Stop the laptop ingestion process and record the completion time of its final upstream request. Wait at least 61 seconds, then enable the hosted owner. Do not run both.
4. Initialize through MCP and verify both accounts and source links in a private window. Do not reintroduce a manual import workflow.
5. Observe a successful hosted signal check. Invoke after the allowed interval; verify repeated signals do not duplicate records and persistent state survives separate function instances.
6. Verify unauthorized ingestion requests return 401 and unsupported writes fail. Confirm private files and secrets are not served.
7. Record the actual URL, provider plan, storage persistence, scheduler frequency and any remaining limits. Replace the local review video with a final hosted walkthrough. Final event submission is separate.

The 90-second lease exceeds the 60-second function limit and 25-second MCP timeout. Redis service failure blocks requests rather than bypassing coordination. Crash recovery waits for lease/cooldown expiry. Event history grows with distinct updates and requires monitoring against the selected store's capacity.

References: [Vercel Functions](https://vercel.com/docs/functions), [Redis REST API](https://upstash.com/docs/redis/features/restapi), [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
