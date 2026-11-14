# Account CRM implementation guide

This repository is the source of truth for the CRM application. Keep implementation in this repository and use a feature branch for the build.

## Product

Build a concise, evidence-backed account workspace. Each account should explain its situation, source-backed commercial value, stakeholder authority, three ranked actions, risks and consequential unknowns. Link interpretations and calculated numbers to their supporting records. Distinguish claims, reported statements and verified evidence. Unknown values must remain unknown, and potential opportunities must not appear as won revenue.

## Technical boundaries

- Configure the upstream credential as server-side environment variable AQ_TOKEN, never a frontend-prefixed variable.
- Keep raw customer/event datasets out of this public repository. Use private runtime storage and fetch configuration, not checked-in personal fixtures.
- Implement a server-side upstream adapter, durable response caching and a single global rate-limit coordinator. Do not give every browser tab its own upstream polling loop.
- Keep read-only views separate from explicitly authorized note writes. Do not expose an anonymous arbitrary API proxy or public write access.
- Validate upstream responses and show loading, unconfigured, partial, stale and error states honestly.
- The data service specification and private account records will be supplied separately to the coding session, without credentials in the prompt.

## Build incrementally

Start with a usable responsive interface and typed data adapter. Then integrate the real dataset, source drill-downs, ranked actions and incoming change detection. Do not fabricate realistic-looking records to imply a live connection. Include setup instructions and meaningful tests for calculations, provenance, null values, updates, caching, concurrency and credential exclusion.

A live deployment and final event submission are distinct actions. Never submit the final event entry without Raj's explicit instruction.
