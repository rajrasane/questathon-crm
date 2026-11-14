# Automatic analysis

`server/analyze.ts` derives the brief from validated discovery, contract/profile evidence, merged request rows, dated signals and calculated usage insights. It runs on the server whenever the source fingerprint or normalizer version changes. It requires no manual import, account-specific rules or external AI service. The same inputs produce the same analysis.

## Evidence and authority

A historical signature identifies the previous signatory, not the current decision maker. An explicit invoice recipient identifies the billing arrangement, not a budget mandate. Contact titles and recorded relationships identify people to consult; potential technical dependencies do not establish veto power. Missing authority is stated explicitly. Source references accompany each assessment, and discovery claims retain their original status.

A savings claim is paired with a qualification only when the same recorded speaker has an upstream-verified, file-referenced savings statement explicitly discussing a model or limitation. The two original statements remain separate. This limited rule does not detect every possible contradiction.

## Three proposed actions

Candidates come from current open/pending requests, account changes, renewal dates, supported savings qualifications and usage stoppages. Priority is an explicit product heuristic, not a customer fact:

| Candidate | Priority |
| --- | ---: |
| Urgent open request | 110 |
| Time-sensitive signal without a request row | 105 |
| Departure/succession signal | 100 |
| Sustained usage stoppage | 95 |
| Unresolved commercial request | 90 |
| Operational coverage request | 85 |
| Savings claim needing finance reconciliation | 82 |
| Technical dependency request | 80 |
| Document request | 75 |
| Renewal decision route | 70 |
| Other account change | 60 |
| Other open request | 40 |
| Authority, qualification and adoption discovery | 35 / 25 / 20 |

Ties use stable keys. The first three candidates are shown. Owners use recorded request owners where available, otherwise proposed internal roles. Dates are proposed follow-ups one, two and three days after the scenario date, never customer commitments or verified deadlines. A recorded request deadline is retained verbatim; an absent year is not invented.

Usage stoppages require flights in each of two consecutive preceding weeks, followed by two consecutive weeks of zero flights with seven days online in each. The inference does not establish a cause or physical location. Dated row details remain in usage analysis.

Request rows merge by stable key in event chronology. Closed requests do not generate actions, and their old signal summaries cannot resurrect the same request as unresolved. Historical signals remain visible as dated reports. Repeated signals do not rewrite the snapshot. New or changed signals regenerate the analysis without a redeploy.

## Limits

The engine recognizes these documented patterns; it is not a general semantic analyst. Historical handover gaps are labeled historical and need reconciliation against newer contacts. Missing or unrecognized records remain explicit unknowns or accessible source evidence. The engine cannot confirm authority or realized value without new customer evidence, and never promotes an offer into booked revenue.
