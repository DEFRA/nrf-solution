Architecture / structure

Functional defects

- Spell out the update-path commands: bash .ai/skills/tools/jira/update-ticket.sh NRF2-XXXX -d - and bash .ai/skills/tools/jira/add-comment.sh NRF2-XXXX - (currently bare/un-named)
- Add a credentials prerequisite (ATLASSIAN_USER/TOKEN, link docs/ai/atlassian-credentials.md) — the writer calls add-jira-link.sh and update-ticket.sh directly, bypassing skill pre-flights
- Remove template-literal traps — ← annotation arrows and [item]/[etc.] placeholders inside the code fence can be copied verbatim into tickets


Spec compliance gaps

- Add "Background and Context" to the ticket template and to reviewer Check A — spec-essential, currently missing from both, so QC can pass without it
- Resolve the summary self-contradiction — "never copy content strings (h1…)" vs "use the exact h1 for the summary": scope the ban to the description; also the h1+"page" summary is a noun phrase where the spec wants "a short, active sentence"
- Pass --parent to create-jira-ticket — spec says "link to the parent Epic"; also decide deliberately on labels/priority (currently defaults only)
- Make "Out of scope" unconditional (even "None") and require it in the reviewer — spec lists it as essential
- Add a rule for drafting the user-need statement when the Confluence spec lacks one
- State the input limitation — only Confluence question-pages supported, vs spec's Figma/Service Blueprint/transcript inputs


Process control

- Cap the Step 5 review loop at 1–2 fix cycles, then report remaining findings to the user instead of repeating until Pass


Duplication / consistency

- Keep one source of truth for shared conventions (error-link format, content-string rules, NFR categories) in the reviewer SKILL.md — currently restated in the writer and NFR lists, drift risk
- Remove the duplicated prototype password from Step 2 — browse-prototype already documents it


Hygiene / conventions

- Fix browse-prototype SKILL.md frontmatter: tools: is an invalid key, should be allowed-tools
=> Maybe look for disallowed-tools instead.Maybe too specific to claude. Jon has to check
- Apply least-privilege tools: drop unused Edit/Write/Grep/Glob from the writer, unused Agent (and friends) from the reviewer
- Add "Use when…" trigger phrasing to both descriptions for better delegation
ex: ""Use when the user shares a Confluence link and asks for a ticket, story, or backlog item."
- Add memory: project to frontmatter — both sibling agents set it
