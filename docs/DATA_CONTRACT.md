# MCP data and cache contract

The normal path is MCP fetch → server cache → validated account snapshot. No manual JSON import is required or exposed.

`server/bootstrap.ts` uses the verified `get_my_accounts`, `get_all_paperwork` and `get_file` tool names and schemas. On each 65-second cycle, it fetches at most one missing baseline resource. Read responses are validated and cached before normalization. Once the baseline is complete it delegates to the signal checker. Cache hits and restart recovery do not repeat completed upstream fetches.

`src/model.ts` defines the normalized presentation contract. `server/raw.ts` validates the upstream discovery, paperwork, file and signal structures. Account-specific data and editorial analysis remain private runtime state, never public fixtures.

Sources retain original discovery fact/person/deal/file IDs. Paperwork uses explicitly local composite IDs resolving to the original `{tool, arguments:{account,path}}` locator. Signal records retain event IDs and nested record paths. A referenced file whose contents are still pending is explicitly marked unavailable; a partial snapshot is not a completed fetch.

Statement kinds are `claim`, `told`, `reported`, `verified`, `interpretation`, and `unknown`. Non-unknown statements require evidence. Missing amounts remain null, and currency cannot be guessed. Contradictions retain both statements. Account offers are not assigned to individual deals without a source link.

Initial account records, historical paperwork and current signals have different provenance and dates. Snapshot generation records local analysis time. Missing original retrieval times are not invented. The latest signal date sets the displayed scenario-as-of date independently of real-world time.

The cache stores validated source responses, the current source bundle, normalized snapshot, merged tables and event-version ledger. Each account's deals remain separate. Private reviewed analysis, when already present, can enrich summary, roles, proposed actions, risks, unknowns and contradictions; it cannot overwrite discovery identities, deal stages or current signals. New signal content invalidates its review fingerprint.

All network attempts share one server-side 61-second reservation written before I/O. Baseline fetching and subsequent signal reads use the same coordinator. The browser only reads cached views. Repeated signal IDs and row keys merge idempotently. No note writes or generic browser-to-MCP proxy are exposed.
