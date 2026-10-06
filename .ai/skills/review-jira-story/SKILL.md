---
name: review-jira-story
description: Reviews a Jira story for completeness, testability, and compliance with write-jira-story conventions
---

## Parameters

`args` is a Jira ticket reference (e.g. `NRF2-1185`) or full URL (e.g. `https://eaflood.atlassian.net/browse/NRF2-1185`). If given a reference, resolve it to `https://eaflood.atlassian.net/browse/<reference>` before proceeding.


## Steps

### Step 1 — Fetch the ticket

Use `read-jira-ticket` with the ticket ID. Work from the raw description text returned.

**If the ticket has no description, stop and alert the user** — do not run the checks against an empty description.

### Step 2 — Run all checks

Run every check below in full. Collect all findings before reporting — do not stop at the first issue.

---

#### Check A — Required sections present

The description must contain all of the required sections in [jira-story-structure.md](../../../docs/ai/jira-story-structure.md). Rows marked Optional in that table (e.g. Out of scope) should only be flagged if present but malformed — do not flag them as missing.

Flag any required element that is missing or malformed. Read the ticket's `*Page type*:` line and apply the page-type rules: a `dropout page` is a dead end, so do not flag the absence of next-page bullets, happy-path scenarios, or error-state scenarios. Do flag any of those if they are present on a `dropout page`.

---

#### Check B — No inline content strings

Content strings (h1 headings, hint text, button labels, error messages) must never appear inline in the description. They must only be referenced via a prototype link.

Flag any AC step or other field that:
- Quotes a visible UI string verbatim (e.g. copies an error message or button label in full)
- Uses quoted wording that looks like it was lifted from the page (e.g. `"Enter your NRL reference"`)

**Allowed:** referring to a page by name without quotes as a navigational reference (e.g. `Given I am on the enter NRL reference page`).

**Allowed:** an unquoted reference to a content link by its spec-supplied text in a content-link scenario (e.g. `*When* I select the get a quote link`).

**Allowed:** the `*User need*:` field containing the full "As a …" statement — this is metadata from the spec, not a UI content string.

**Required for error states:** error outcomes must link to the prototype's error state via a `?preview=1&error=<value>` query string, not to the base prototype URL and not inline text. `<value>` is `1` for an empty/no-value submission, or `format` for an invalid-format value.

---

#### Check C — AC testability

For each scenario, verify:

1. **Starting URL is resolvable** — if the `Given` clause says the user is on a named page, that page's URL must appear under `h2. URLs → *This page*:`, `*Back link*:`, or `*Next page*:`. Flag it if the URL cannot be determined from the URLs section alone.
2. **Outcome URL is resolvable** — if the `Then` clause says the user is taken to another page, that destination must also appear in the URLs section. Flag any `Then` step that names a destination whose URL is not listed. **Exception:** content-link scenarios (`*When* I select the … link`) state their destination path or URL directly in the `Then` step — that is correct, do not flag it for being absent from the URLs section.
3. **No ambiguous placeholders** — steps must not contain `[url]`, `[page name]`, `[prototype-url]`, or any other unfilled placeholder. Prototype links must be real URLs.
4. **Error-state ACs link to the prototype error state** — `Then` steps describing an error outcome must link to the prototype URL with `?preview=1&error=<value>` appended — `error=1` for an empty/no-value submission, `error=format` for an invalid-format value (e.g. `[prototype error state|https://…?preview=1&error=1]`). Flag any error-state `Then` step that quotes error text inline or links to the prototype without the query string.

---

#### Check D — NFR completeness

Use the mapping in [non-functional requirements](../../../docs/ai/non-functional-requirements.md) to check that all NFR categories applicable to the ticket's page type (`question page` or `dropout page`) are linked to in the `h2. Non-functional requirements` section.

A category may legitimately be omitted if the ticket includes a brief note explaining why it doesn't apply to this ticket — treat that as a pass, not a finding. Flag only categories that are missing with no exclusion rationale given.

---

#### Check E — AC distinctness

Every scenario must test something distinct. Compare the full set of scenarios against each other, not just each one in isolation:

1. **Each scenario is specific enough to be testable** — its `Given`/`When`/`Then` must name concrete conditions, actions, and outcomes (a named page, a specific input value, a specific error, a named destination). Flag any step that's too generic to pin down a single observable pass/fail condition (e.g. `*Then* the correct behaviour occurs`, `*When* the user interacts with the form`, `*Then* an appropriate error is shown`).
2. **No two scenarios overlap** — for every pair of scenarios in the ticket, check whether their `Given`/`When`/`Then` combination actually distinguishes one from the other. Flag a pair if nothing in the steps would tell you which scenario failed if the underlying behaviour broke — e.g. two entry-point blocks with identical back-link/next-page behaviour split for no testable reason, or "missing value" and "invalid format" scenarios worded so loosely that either description could apply to either case.

When flagging an overlap, quote both scenario headings plus the step(s) that collide, and say whether they should be merged into one scenario or given an explicit distinguishing condition.

---

### Step 3 — Report

Return a structured report with one section per check. For each check, list:

- **Pass** — if no issues found
- **Finding:** [description] — for each issue, with the relevant excerpt from the ticket

End with a one-line overall verdict: **Pass** (no findings) or **Fail** (N findings).
