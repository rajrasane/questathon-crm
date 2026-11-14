# Three-minute walkthrough

Record the final deployed UI after visual and functional checks. This sequence starts with the build reasoning, then demonstrates the product. The captioned review video is silent so the owner can add their own voice-over. Keep credentials, terminals and unrelated tabs out of frame.

| Time | Focus | Suggested voice-over |
| --- | --- | --- |
| 0:00–0:14 | The problem | Account Brief is a CRM for someone taking over an unfamiliar account. My starting question was simple: can a new owner understand the situation, find the evidence, and choose the next conversation? |
| 0:14–0:28 | The thinking | I designed around three decisions: what is commercially at stake, who can influence the outcome, and what should happen next. AI helped me build the software; the analysis uses explicit, repeatable rules. |
| 0:28–0:42 | The design choices | The key choice was to preserve uncertainty. Claims, reports and verified records stay distinct. Missing values stay unknown. The interface gives a short overview first, with supporting detail available when you need it. |
| 0:42–0:56 | 01 / Portfolio | The portfolio brings the accounts together. This opportunity chart shows recorded stages, and selecting a stage finds the relevant accounts. Existing contracts stay in their original currencies. The conversation cards surface each account's first proposed action. |
| 0:56–1:12 | 02 / Commercial context | Inside an account, existing annual contract value, opportunity value and new booked value are separate. A discovered opportunity is not a closed deal. Clicking Evidence opens the underlying record, so a judge or account owner can check the basis. |
| 1:12–1:30 | 03 / Next actions | The next three actions are ranked from the evidence. Expand one to see its proposed owner and date, the reason, and the intended outcome. These are suggested follow-ups, not customer commitments. Risks and unanswered questions explain what still needs resolving. |
| 1:30–1:46 | 04 / People | The people view separates decision authority, budget, operations and dependencies. It shows where each role stands and the supporting assessment. A job title, historical signature or friendly contact does not automatically establish current purchasing authority. |
| 1:46–2:02 | 05 / Deals | Each opportunity keeps its own stage, value, blockers, deadline and evidence. Offers remain separate from booked revenue. When a value, currency or deadline is missing, the app says so instead of inventing a number or pretending the deal was won. |
| 2:02–2:18 | 06 / Operational evidence | The flight activity chart makes operational patterns easier to inspect. Each point links to its source rows and shows how many devices were represented. Missing weeks are not zero. A usage drop prompts investigation; it does not prove a cause. |
| 2:18–2:32 | 07 / Conflicting evidence | Conflicting evidence stays visible side by side. For example, a savings claim and a supporting projection need reconciliation before anyone calls them realized savings. The app identifies a next step to resolve that disagreement. |
| 2:32–2:44 | 08 / New accounts | Released accounts appear through the same ingestion and analysis path. They use the same views and evidence rules. The workspace can grow without hard-coding a separate dashboard for every new account. |
| 2:44–2:56 | 09 / Live connection | The server stores fetched records and coordinates rate-limited checks. Status shows what completed and when signals were last checked. Refresh reads the cache. Credentials stay on the server. |
| 2:56–3:00 | Account Brief | The result: a traceable next decision, with honest uncertainty. |

The script is approximately 429 words: about 143 words per minute over three minutes. Read naturally and follow the chapter timings. Captions are provided for the prepared video; they are not evidence of recorded narration.

Demonstrate actual source drawers and recorded status. Do not claim that a newly arriving live event was observed unless it was; mocked changed-signal tests establish tested behavior only. A status timestamp describes a completed check, not a promise of future uptime.
