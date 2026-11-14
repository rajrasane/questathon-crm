# Account Brief: implementation thinking

The primary job is deciding what to do next. A CRM should explain the account situation before exposing its evidence. The interface therefore leads with commercial value and stage, followed by a concise situation, three proposed next actions, authority roles, risks, unknowns and contradictions. Evidence is available on demand through source links and a searchable library.

## Truth before completeness

The absence of a record is an unknown, not zero or a positive outcome. Monetary values preserve their basis: booked, pipeline or projection. Reported statements are distinct from verified evidence and interpretations. Contradictory statements remain side by side until reconciled. All factual statements need resolvable references; action recommendations are visibly proposed and do not imply a customer commitment. Missing owners and dates are displayed as unassigned and to agree.

## A small, defensible architecture

React handles navigation and evidence inspection. A small Node server exposes only the normalized private snapshot. A validated import boundary prevents guessed mappings from unfamiliar source structures. Atomic private-file replacement preserves the last valid snapshot on failed imports. The browser never receives the upstream credential or raw source cache.

The isolated MCP adapter reserves a persistent 61-second budget before every request, including failures and writes. A filesystem lock coordinates processes sharing a directory; exclusive ingestion ownership is required across environments. Responses are validated before durable caching. No upstream tool schemas are assumed, no browser proxy exists, and no live ingestion runs in the initial app. Notes require an explicit server-side operation after schema verification.

## Verification and next milestone

Tests cover null values, evidence references, contradictions, snapshot updates and stale/error states, cross-process concurrency, restart cooldown, failed-call budget and cache reuse. Type checks, lint and production builds protect the implementation boundary. Synthetic test fixtures are isolated from the interface.

The next milestone is importing the authorized private handoff, checking each source mapping, verifying account conclusions and reviewing ranked actions with their owners and dates. Deployment, public data access and event submission remain separate decisions. This document describes the implementation approach; it is not a claim that private data integration or live hosting is complete.
