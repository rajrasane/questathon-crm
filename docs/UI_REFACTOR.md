# Focused account workspace

Branch: `feat/focused-ui`. This change affects presentation only. The account model, analysis rules, source cache and sole-runtime MCP coordination are unchanged.

## Design direction

The opening screen should help an account owner choose the next conversation, with deeper reading available on demand. A full document dump makes the ranked actions harder to find.

The visual system uses a cool workspace background (`#f5f7fa`), white document surfaces (`#ffffff`), slate text (`#253247`), muted secondary text (`#5e6c80`), blue interactive controls (`#315bc9`) and amber evidence gaps (`#925413`). Native Aptos/Segoe UI typography avoids an external font dependency. Left-aligned content, a narrow account rail and a restrained type scale support reading. Numbering appears only on ranked actions.

The initial layout plan was reviewed against the text-overload problem: large promotional headings, decorative labels, repeated source filenames and stacked full-width reports were removed. A persistent view selector replaces the long all-in-one page.

```text
Account rail | Account name / data status
             | Overview | Deals | People | Evidence
             | Existing contract / opportunity value / new booked value
             | Ranked actions             | Dated signals
             | Risks, open questions, conflicts, usage (expandable)
```

- Overview: commercial context, three compact proposed actions, recent changes and expandable evidence gaps.
- Deals: individual opportunities with expandable stage, blockers, deadline, value evidence and linked offers. Unlinked account offers remain separate.
- People: decision, budget, operations and dependencies. Each assessment expands without treating a contact title as authority.
- Evidence: searchable account-scoped records, with an explicit all-accounts option.
- Source drawer: every supporting record remains accessible. Multiple source IDs become one compact evidence control with a source selector. Provenance metadata is retained under record details.

Claims and verified evidence keep their distinct labels. Proposed dates remain proposals. Missing values remain unknown. No account-specific records or content are built into the client.

## Skills consulted

Discovered through the user-requested [Skill Issue MCP](https://skill-issue.in/api/mcp):

- [Frontend Design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md): deliberate visual hierarchy, restrained typography, progressive disclosure and screenshot critique.
- [React Best Practices](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md): indexed source lookups, conditional view rendering and avoiding unnecessary dependencies.

The catalogue's existing-project redesign listing redirected to a different skill page; it was not used as the design instructions. Skill content was read directly, without installing third-party scripts into the app.

## Validation

- Lint, TypeScript/build and the existing 39 tests.
- Chromium checks at 1440px, 390px and 320px, using private cached records only.
- Both accounts; ranked action expansion; opportunity details; all four stakeholder roles; evidence search and account scope; source selection; Escape dismissal and focus restoration; arrow-key tab navigation.
- No horizontal overflow across the four views at phone widths, and no browser JavaScript errors.
- Empty state does not show sample accounts. A failed refresh retains the last loaded snapshot and displays an error.

No MCP ingestion process was started for browser validation. Screenshots and private fixture data are excluded from Git. Hosting remains a separate task.
