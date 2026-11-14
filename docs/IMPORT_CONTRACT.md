# Private snapshot integration contract

This is the app's normalized presentation contract, not a guessed upstream schema. The authoritative validator is `snapshotSchema` in `src/model.ts`. Transfer actual records through private runtime storage only; do not add an account example to this public document.

## Provenance and statement meaning

Every source contains `id`, `title`, `locator`, `retrievedAt` (ISO timestamp), and `excerpt`. Keep the original source locator intact. Reference source IDs from every factual statement, identity, known amount and known deadline. References must resolve in the same snapshot.

Statement `kind` preserves these distinct meanings: `claim`, `told`, `reported`, `verified`, `interpretation`, `unknown`. Do not promote a claim or a told/reported statement to verified merely because it appears in an export. Retain contradictory statements separately. Unknown statements may have no source reference; other kinds require at least one.

## Account and deal detail

Account fields remain in `accountSchema`. The additional `deals` field is nullable and defaults to null for compatibility with older snapshots. Null means records have not been mapped; an empty array means no deals are listed in this snapshot. Neither implies zero revenue.

Each deal has:

- `key`: a stable local UI key, not a claimed upstream identifier. Preserve upstream IDs in private source locators when provided.
- `title` and `sourceIds`: the opportunity and its evidence.
- `stage`: a sourced statement preserving the upstream stage.
- `worthUpTo`: `{amount, currency, basis, sourceIds}`. Keep missing amount/currency null, with basis `unknown`; never infer a currency or substitute zero. Known values require basis and evidence. If an upstream value has no currency, preserve the numeric amount with null currency; the UI labels that uncertainty and never aggregates it.
- `blockers`: a sourced statement or null when unknown.
- `deadline` and `deadlineSourceIds`: null with empty references when unknown; known deadlines require evidence.
- `offers`: null for unmapped records, or an array. Each offer has `title`, `sourceIds`, `status`, `statusSourceIds`, and `value` using the same monetary shape. Status is `open`, `declined`, `won`, or `unknown`; known status requires evidence.

No deal or offer is automatically included in booked revenue. Account book value requires its own supporting records. There is deliberately no summation of unknown, mixed-currency, pipeline or projected amounts.

## MCP boundary

Work remains the sole upstream caller. No endpoint is invoked by importing a snapshot or refreshing the browser. Tool schemas must be verified before registration in the adapter.

The transport sends `Accept: application/json, text/event-stream`. For a JSON-RPC JSON response, it checks for transport/tool errors, reads the first text content block, parses its JSON string, then validates that decoded payload against the registered output schema. It caches only validated decoded data. Malformed or non-text content fails closed. Streaming SSE response parsing is implemented and tested with synthetic envelopes; no live upstream call has been made by this app during integration.

The next integration step is private schema mapping and full provenance validation. Preserve every deal independently and review every mapping against the supplied source evidence before importing.

## Raw bundle and prepared runtime import

`server/import-bundle.ts` validates the actual export structure and maps it into the presentation schema. A prepared runtime file wraps `{bundle, analysis}`. The optional private analysis file contains `basedOnSignals` (canonical fingerprint) and account-keyed editorial fields. The allowed overlay is summary, stakeholder-role analysis, proposed actions, risks, unknowns and contradictions. Current discovery identities, deal stages and signals cannot be overwritten by this overlay. Every resulting reference is validated before import.

Paperwork gets a clearly local composite source ID and an original `{tool, arguments:{account,path}}` locator. Discovery fact, person, deal and file IDs are preserved. Signal records retain their original event IDs and paths. No current account identifier or conclusion is embedded in public fixtures.

Missing source retrieval times remain null; `importedAt` records local ingestion separately. The latest signal date defines the displayed scenario-as-of date. Proposal dates must be interpreted in that scenario, not as real-world customer commitments.

The runtime creates private `bundle.json`, `analysis.json` (when supplied), `snapshot.json`, `merged-tables.json`, and `ledger.json`. Exact repeats are no-ops. Signal edits keep version hashes in the ledger. The browser reads the snapshot, never those raw files.
