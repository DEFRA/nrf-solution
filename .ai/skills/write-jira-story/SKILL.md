---
name: write-jira-story
description: Creates and updates a Jira story for backend, calculation or admin work (not a single journey page) using a feature specification in Confluence, with single-line bold-label numbered acceptance criteria. For a journey page story (question, content, check your answers, dropout or confirmation page) use write-jira-story-from-prototype instead.
allowed-tools: Read, Bash
model: inherit
skills:
  - util-read-jira-ticket
  - util-create-jira-ticket
  - util-read-confluence-page
  - util-browse-prototype
  - review-jira-story
---

You produce clear, testable Jira tickets for backend, calculation, admin and other work that isn't
a single journey page, using feature specifications written in Confluence. Acceptance criteria are
single-line bold-label numbered items (`# *<Prefix>:* <sentence>`), not Given/When/Then. See
[ac-testability.md](../../../docs/ai/ac-testability.md) for what makes one testable and distinct —
apply it while drafting, not just at review time.

## Prerequisites

`ATLASSIAN_USER` and `ATLASSIAN_TOKEN` environment variables must be set before running. See [docs/ai/atlassian-credentials.md](../../../docs/ai/atlassian-credentials.md) for setup instructions.

## Input - feature specification

You'll be given a feature specification in Confluence as an input parameter (example - https://eaflood.atlassian.net/wiki/spaces/NRFDT/pages/6596757546/Enter+NRL+reference).

Only Confluence pages are supported as a source format. Figma files, Service Blueprints, and transcripts are out of scope.

**If the spec has a `Page type` line (`*Page type*:` in Jira, or plain `Page type:` in a Confluence spec)** (`question page`, `content page`, `check your answers page`, `dropout page` or `confirmation page`), it describes a single journey page — stop and tell the user to use `write-jira-story-from-prototype` instead, passing the spec's prototype URL and, optionally, this Confluence page as its second parameter.

## Workflow

### Step 1 — Read the Confluence spec

Use `util-read-confluence-page` on the provided URL. Extract:

- Feature (link), User need (three lines: "*As a* <user type> / *I want* … / *So that* …")
- The triggers and behaviour the ticket owns: calculations, defaults, exclusions, timing rules, which values are returned, which date decides a lookup
- Any page or admin screen the ticket's ACs will reference: its route, and (if the spec gives one) a prototype link
- Out of scope (only if present in the spec — omit from the ticket if the spec has none)
- NFRs (if present — additive to the guidance-page baseline)

**If the spec has no user-need statement, stop immediately and alert the user** — do not draft a ticket without one.

**Check for an existing Jira story link:** look for a `Jira story:` line in the page body (format: `<strong>Jira story</strong>: <a href="...">NRF2-XXXX</a>`). If found, extract the ticket key — this is an existing ticket and Step 4 must update it rather than create a new one.

### Step 2 — Confirm UI references

Only when the spec names a page or admin screen that an AC will reference. Use `util-browse-prototype` to:

- Confirm its prototype URL path begins with `/handoffs`. If not, stop and alert the user, listing the offending URL — do not draft a ticket against a prototype that isn't dev-ready.
- Capture its exact h1 — used as the page title in ACs and the Page URLs section, never the spec's wording for it.

Skip this step entirely for a spec with no UI surface (pure backend or calculation work).

### Step 3 — Draft the ticket description

Sections, in order: User story; `h2. Acceptance criteria`; `h2. Page URLs` (only if any AC names a page); `h2. Out of scope` (only if it has content); `h2. Non-functional requirements`; `h2. Testing notes` (only if needed, see below).

**Ticket summary:** a short plain-text description of the behaviour, e.g. "Apply inflation index to stored quotes".

**Generated from timestamp:** include both date and time in the `*Generated from*:` line — e.g. `on 21 Sep 2026 at 14:30`.

**Testing notes:** end the description with `h2. Testing notes` (after `h2. Non-functional requirements`, nothing follows it) whenever `test-in-browser` would need something the ACs don't give it, following [ac-testability.md](../../../docs/ai/ac-testability.md): test users or data (e.g. a Defra ID user for a page behind sign-in), how to reach a state, and how to test a change a browser can't exercise (an API or calculation change: the request, the expected response, a worked example). Don't prescribe journey tests; that is the developer's call. Omit the section when none of this applies. Never put secrets in it.

#### Content strings and prototype links

Never copy content strings from a prototype into the ticket description — link to the prototype instead, which is the single source of truth for all wording. This covers hint text, button labels, error messages, and any body copy.

Exceptions:
- A page name may appear in an AC as a navigational reference, in italics (e.g. "_Enter your NRL reference_ page") — never in quotes, never as a route or URL.
- Page names captured in Step 2 are used verbatim as the bullet labels in the Page URLs section — these come from the prototype, not the spec.

For an error-state AC, link directly to the prototype error state (e.g. `?preview=1&error=format`) rather than quoting the error text.

#### Acceptance criteria

Use Jira wiki markup, not Markdown: `# *<Prefix>:* <sentence>.` — one numbered item per scenario, numbered items only for ACs (NFRs stay as bullets).

- The bold prefix succinctly names the scenario; the sentence doesn't repeat it.
- Name the trigger (a user action, a specific endpoint call, a scheduled job, a named ticket's behaviour) and the observable outcome with a concrete value: a page and its content, an endpoint response field, a stored record and its columns, an admin page. "Is recalculated", "is held", "is refused" and "is stored" are not enough — name the output and give an expected value, using a worked example where there's a calculation or rule.
- One behaviour per AC: no "or" joining two triggers, pages or outcomes; no slashes in place of a word ("calculated/recalculated"); no ambiguous "it" — repeat the noun.
- Refer to pages by title, in italics, exactly as the h1 appears in the prototype — never by route. Routes live in the Page URLs section only.
- Validation or error ACs name the validation in brackets (e.g. `*Form validation (missing value):*`) and link the prototype error state, instead of saying "valid".
- Don't write an AC for behaviour another ticket owns — link to that ticket's key instead.
- Don't write two ACs that differ only by a case another AC already covers; merge them or add a distinguishing condition.
- See [ac-testability.md](../../../docs/ai/ac-testability.md) for the full testability and distinctness checklist.

#### Page URLs section

Only when an AC names a page. `h2. Page URLs`, a two-column table (page title, route): one row per page named in an AC, using the exact h1 captured in Step 2. Every row is named in an AC; every page an AC names has a row.

### Step 4 — Create or update the ticket

- **No existing ticket:** use `util-create-jira-ticket` with `--summary` and `--description`. Then run `node .ai/skills/tools/confluence/add-jira-link.mjs PAGE_ID JIRA_KEY JIRA_URL` to write the ticket link back to the Confluence spec — this enables future re-runs to detect and update the existing story. If the script fails for any reason, stop and report the exact error; do not work around it by calling the Confluence API directly.
- **Existing ticket key found** (from Step 1 or provided by the user): update the description by piping it to `node .ai/skills/tools/jira/update-ticket.mjs NRF2-XXXX -d -`, then add a comment summarising what changed using `node .ai/skills/tools/jira/add-comment.mjs NRF2-XXXX -`. Do not call `add-jira-link.mjs` — the link is already on the page.

### Step 5 — Self-check, then review

First, check the draft against [Rules for every story](#rules-for-every-story) below and fix every miss. `review-jira-story` fails tickets on these points, so catching them here saves a review cycle.

Then review the ticket with the key from Step 4, whether it was just created or updated, using the `review-jira-story` skill. If any findings are returned, fix them once by piping the revised description to `node .ai/skills/tools/jira/update-ticket.mjs NRF2-XXXX -d -`. Do not loop — if findings remain after this single fix cycle, report them to the user in Step 6 rather than continuing to revise.

### Step 6 — Report

Return the ticket key and URL, plus a one-line summary of the reviewer outcome (Pass, or how many findings were fixed and any that remain).


## Rules for every story

Apply these to every ticket.

### Triggers and observability
- Every AC names a trigger that exists and is built by this story or a linked one: a specific page's Continue, a named endpoint call, a scheduled job. If the trigger isn't built here, don't write the AC here: move it to the owning story, or ask the user which ticket owns it.
- Every AC names where a tester sees the result and the concrete value: a page and its content, an endpoint response field, a stored database record and its columns, or an admin page.
- Where the spec has a calculation or rule table, give each example concrete inputs and expected outputs, and reference the example in the matching AC. Examples must use the same method as the ACs (for example per-year values if the ACs say per-year, not one combined factor).
- Every rule stated in Context, Notes or Examples (timing, defaults such as a factor of 1.0000, exclusions such as VAT, which values are returned, which date decides a lookup) has an AC, or is removed from the ticket.
- Where an AC needs a prior state, say how a tester reaches it, naming the story that creates the data (e.g. "an inflation index has been added through NRF2-XXXX").

### One behaviour, clear wording
- Never join two triggers, pages or outcomes with "or" in one AC. Write one AC per case.
- No slashes in place of a word, no ambiguous "it" (repeat the noun), no duplicated clauses, no unclosed brackets, no stray attributions ("as quoted by …"), no stray notes inside examples, no capitalised emphasis ("NOT").
- An AC's bold prefix matches its sentence and the trigger named in Context. If Context says a behaviour holds "even if the values are unchanged", write an AC for it.
- Don't write two ACs that differ only by a case another AC already covers; merge them or add a distinguishing condition. Don't repeat an AC that another ticket owns; link to that ticket instead.
- The user-need statement must match what is observable in scope. If display changes are out of scope, don't say the user "sees" the value; say what the service does.

### Terminology
- Define each domain term once, in a terminology note, and use it identically everywhere in the ticket and in sibling tickets in the same feature. Check Context bullets, ACs, examples and Out of scope for older or alternative names, and make them match the note.

### Cross-ticket consistency
- Before drafting, read the linked, referenced and sibling tickets (`util-read-jira-ticket`; siblings via `node .ai/skills/tools/jira/get-epic-issues.mjs <PARENT_KEY>`). Check for the same condition with a different outcome, duplicated ACs, and two tickets owning the same table, page or behaviour. Resolve each: say which ticket owns it, and add a Context line where two tickets use similar words for different things (e.g. "history of quote answers" versus "history of levy calculations").
- Every ticket key mentioned anywhere in the description is a Jira link on the ticket, added once only (no duplicates). Strip tracking parameters from Jira and Confluence URLs.
- Each out-of-scope item that another ticket owns names that ticket's key. A key in the description must refer to a different ticket from the one being written.
- When a ticket reuses another's endpoint, calculation or table, name it with its key and link it in Context.
- When a story creates or changes stored data, an AC covers the storage, who made the change where users edit data (audit trail), and either an AC or an explicit linked ticket covers the data catalogue update (see the `data-catalogue` skill). If stored data should be viewable for testing, say which ticket provides the view.

### Pages and prototypes
- Any story where a user or admin does something in a UI names the page, its route and a dev-ready prototype link (path begins with `/handoffs`) in Page URLs. If the spec lacks one, stop and ask rather than writing "I add an X" with no location.
- Validation or error ACs link a prototype error state, and say what counts as a valid value (type, range, format) instead of "valid".
- Prototype links that redirect (302 when fetched) probably need a sign-in; say they couldn't be checked rather than assuming they load.
- Every page URL listed is named in an AC; every page an AC names has a URL.

### Metadata
- Fill in labels where the project uses them, and the parent. Fill every NFR bullet with its guidance-page link; the NFR section is never empty or a bare `?`. Security applies wherever there is user or admin input.
- Include the Testing notes section where it applies (see Step 3).

## Non-functional requirements

Every ticket must include an `h2. Non-functional requirements` section, separate from the acceptance criteria.

Use the mapping in [non-functional requirements](../../../docs/ai/non-functional-requirements.md).

Steps:

1. Work from the cached category list above — do **not** fetch the guidance index or child pages on every run. The category name is enough to judge relevance in almost every case (Accessibility and Security are self-explanatory for a page with form input). Never list Browser & device compatibility or Page load performance, even if the guidance index shows them.
2. For each category, decide whether it applies given the specifics of the feature spec. Skip a category only when it clearly doesn't apply. Briefly note any category you deliberately excluded so the user can push back.
3. If a category name is genuinely ambiguous for the ticket in front of you, fetch that one child page via `util-read-confluence-page` to read the guidance — but do not paste the guidance into the ticket.
4. In the ticket's `h2. Non-functional requirements` section, list each applicable category as a bullet linking to its Confluence page. Use Jira wiki-markup link syntax, e.g. `* [+Accessibility+|https://eaflood.atlassian.net/wiki/spaces/NRFDT/pages/6538166273/Page-level+accessibility+guidance]`.
5. Append any NFRs listed in the spec's own NFRs section as additional bullets. Spec-listed NFRs are additive — they extend the guidance baseline, they don't override it. Include the spec's wording as text (there is no guidance-page link to reference).
6. List **all** relevant NFRs explicitly in the ticket. Don't skip any on the assumption that "the team always does this" — being explicit is the whole point.
