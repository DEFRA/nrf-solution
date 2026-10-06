---
name: write-jira-story
description: Creates and updates a Jira story using a feature specification in Confluence. Use when the user shares a Confluence link and asks for a ticket, story, or backlog item.
allowed-tools: Read, Bash
model: inherit
skills:
  - read-jira-ticket
  - create-jira-ticket
  - read-confluence-page
  - browse-prototype
  - jira-story-reviewer
---

You produce clear, testable Jira tickets, using feature specifications written in Confluence.


## Prerequisites

`ATLASSIAN_USER` and `ATLASSIAN_TOKEN` environment variables must be set before running. See [docs/ai/atlassian-credentials.md](../../../docs/ai/atlassian-credentials.md) for setup instructions.


## Input - feature specification

You'll be given a feature specification in Confluence as an input parameter (example - https://eaflood.atlassian.net/wiki/spaces/NRFDT/pages/6596757546/Enter+NRL+reference).

Only Confluence pages are supported as a source format. Figma files, Service Blueprints, and transcripts are out of scope.

### Page type
Supported page types:

- **question page** — a standard gov.uk form page: has form validation and an onward journey.
- **dropout page** — a dead-end page shown when the user can't continue (e.g. they're not eligible). No form, no validation, no onward journey. Has a back link.
- **confirmation page** — a dead-end page shown after the user submits a form, confirming what has happened (e.g. an email has been sent). No form, no validation, no onward journey. No back link — if the user uses the browser back button, they are redirected to a URL given in the spec.

Read the `Page type` from the spec and follow the matching branch in the steps below. If the page type is missing or is anything else, stop and alert the user.


## Workflow

### Step 1 — Read the Confluence spec

Use `read-confluence-page` on the provided URL. Extract:

- Feature (link), User need (three lines: "*As a* <user type> / *I want* … / *So that* …"), Page type, Prototype URL
- Navigation: route, all entry points and back link rules (every distinct previous-page destination); for a `question page` also next page route(s) (every distinct next-page destination if routing is conditional)
- Navigation, `confirmation page` only: route, each `Previous page` (route and, if given, a prototype link — this is the entry point, the page whose form submission leads here), and the `Browser back` redirect destination (a path or full URL). There is no back link and no next page. If the spec has no previous page or no browser back redirect, stop and alert the user rather than guessing
- Content links (if present, any page type): a single link appears inline as `Content link: <text> - <destination>`; multiple links appear under a `Content links:` heading as a bulleted list. Each link gives all or part of the link text as it appears in the page content, and the path or full URL the link goes to
- Form validation (`question page` only): field validations, whether the user's entry is saved and re-shown on return
- Out of scope (only if present in the spec — omit from the ticket if the spec has none)
- NFRs (if present — additive to the guidance-page baseline)

**If the spec has no user-need statement, stop immediately and alert the user** — do not draft a ticket without one.

**Check for an existing Jira story link:** look for a `Jira story:` line in the page body (format: `<strong>Jira story</strong>: <a href="...">NRF2-XXXX</a>`). If found, extract the ticket key — this is an existing ticket and Step 4 must update it rather than create a new one.

### Step 2 — Browse the prototype

Use `browse-prototype` with the prototype URL from the spec.

**`dropout page`:** in a single browser session, capture the exact h1 from the page (used for the ticket summary and the "this page" name in the Page URLs section). Then, for each distinct previous-page destination in the spec's back-link rules, reach the dropout page via the corresponding entry point, click the back link, and capture the h1 of the page you land on (the "previous page" name). Skip the remaining steps below — there is no form, error state or next page.

**`confirmation page`:** in a single browser session:

1. Capture the exact h1 from the confirmation page (used for the ticket summary and the "this page" name in the Page URLs section). Confirm the page has no back link; if it has one, note it for the report.
2. For each previous page in the spec, open its prototype link (if the spec gives none, stop and alert the user), capture its h1 (the "previous page" name), submit a valid value and follow Continue, and confirm you land on the confirmation page. If you can't reach it, note it for the report — the previous page name is still taken from its h1.

Do not browse to the browser-back redirect destination or look up its page name. Skip the remaining steps below — there is no form, error state or next page.

**`question page`:** in a single browser session:

1. Capture the exact h1 heading from the happy-path page (used for the ticket summary, and as the "this page" name in the Page URLs section).
2. Submit a valid value and follow Continue to reach the next page; capture its h1 (the "next page" name). If the spec's Navigation section describes more than one possible next page, repeat for each distinct destination.
3. Return to the happy-path page. If it has a back link, click it to reach the previous page and capture its h1 (the "previous page" name). If the spec's back-link rules describe more than one possible previous page, repeat for each distinct destination — re-enter the happy-path page via each entry point described in the spec to reach the corresponding back-link target.
4. Submit the form empty — and with an invalid value where the spec lists a format rule — to confirm each error state is reachable. You do not need to capture the error text; ACs link directly to the prototype error state by appending `?preview=1&error=1` to the prototype URL.

If the spec lists content links, confirm in the same session that each one appears in the page content of the happy-path page (or, for a `dropout page` or `confirmation page`, of the page itself) (match on the link text from the spec). If one can't be found, note it for the report and omit its AC block — do not guess.

Page names must come from the prototype, never from spec wording — you only need each page's h1 and confirmation that each error state and content link is reachable, not the full JSON output of the extraction script.

### Step 3 — Draft the ticket description

Use the structure in [jira-story-structure.md](../../../docs/ai/jira-story-structure.md)

**Ticket summary:** use the exact h1 from the prototype (step 2), suffixed with "page" — e.g. "Enter your NRL reference page".

**Generated from timestamp:** include both date and time in the `*Generated from*:` line — e.g. `on 21 Sep 2026 at 14:30`.

#### Content strings and prototype links

Never copy content strings from the prototype into the ticket description — link to the prototype instead, which is the single source of truth for all wording. This covers hint text, button labels, error messages, and any body copy.

Exceptions:
- The h1 is used verbatim as the ticket summary (see above).
- Page names may appear in Given/When/Then clauses as navigational references (e.g. "Given I am on the enter NRL reference page") — do not put them in quotes.
- Page names captured in Step 2 are used verbatim as the bullet labels in the Page URLs section (see below) — these come from the prototype, not the spec, so they aren't a copy of spec wording.
- The link text given in the spec's content link(s) may appear in the content-link AC (e.g. "the get a quote link") — it is only there to identify which link to select. Do not put it in quotes, and do not add the rest of the link text from the prototype.

For error states (`question page` only), link directly to the prototype error state. Use the prototype URL from the spec's form validation section if one is provided (e.g. `?preview=1&error=format`). Fall back to appending `?preview=1&error=1` only when the spec does not give a specific error URL for that validation.

#### Page URLs section

Build the `h2. Page URLs` bullets from the routes in the spec's Navigation section and the page names captured in Step 2:

- `* *<this-page name> (this page):* <route>`
- `* *<previous-page name> (previous page):* <route>` — one bullet per distinct previous-page destination described in the spec's back-link rules. Omit entirely if the page never has a back link. For a `confirmation page` (which has no back link), use one bullet per `Previous page` in the spec, with that page's route.
- `* *<next-page name> (next page):* <route>` — one bullet per distinct next-page destination. `question page` only — `dropout page` and `confirmation page` have no next page, so omit these bullets. Do not add the browser-back redirect destination to the Page URLs section.

Do not add parenthetical explanations of when each conditional destination applies (e.g. "shown only when arriving from X") — that detail belongs in the acceptance criteria, not the Page URLs section.

#### Acceptance criteria — dropout page

Use the same block format as for a `question page` (see below), but only these scenarios, in this order:

1. **Each entry point → page loads** — one block per distinct route into the page (from the spec's Navigation > Entry points section). Each block must end with `*And* the main page heading and content should match the [+prototype+|PROTOTYPE_URL]`.
2. **Back link** — same rules as for a `question page`: one block if the destination is always the same, otherwise one block per distinct case naming the entry point in the `Given` clause. Refer to the destination by its page name only.
3. **Content links** (only if the spec has a `Content link` / `Content links` entry) — see [Content link scenarios](#content-link-scenarios).

Do not write happy path, missing value, invalid format or entry-is-re-shown scenarios — a dropout page has no form and no onward journey. Do not add a scenario for the absence of a Continue button or form; the prototype link in the entry-point scenario already covers page content.

#### Acceptance criteria — confirmation page

Use the same block format as for a `question page` (see below), but only these scenarios, in this order:

1. **Entry point → page loads** — one block per `Previous page` in the spec. Each block must end with `*And* the main page heading and content should match the [+prototype+|PROTOTYPE_URL]`.

   ```
   h3. Scenario N - Entry point from the <previous-page name> page
   *Given* I am on the <previous-page name> page
   *When* I submit valid details and continue
   *Then* I am taken to the <this-page name> page
   *And* the main page heading and content should match the [+prototype+|PROTOTYPE_URL]
   ```
2. **Browser back** — the confirmation page has no back link, so do not write a back link scenario. Write one block for the spec's `Browser back` redirect. State the destination as a path or full URL exactly as given in the spec (not a page name), and do not repeat the spec's parenthetical about where the user is not sent.

   ```
   h3. Scenario N - Browser back button redirects
   *Given* I am on the <this-page name> page
   *When* I use the browser back button
   *Then* I am redirected to <path or full URL from the spec>
   ```
3. **Content links** (only if the spec has a `Content link` / `Content links` entry) — see [Content link scenarios](#content-link-scenarios).

Do not write happy path, missing value, invalid format, back link or entry-is-re-shown scenarios — a confirmation page has no form, no back link and no onward journey.

#### Acceptance criteria — question page

Write one scenario per block. Each block's `h3.` heading is `Scenario N - <summary>` — the number, a hyphen, then a short plain-text phrase (no markup) stating what the scenario tests, all on the same line. The step lines start on the next line. Example: `h3. Scenario 1 - Entry point from the previous page`. Use Jira wiki-markup bold for the step keywords: `*Given*`, `*When*`, `*Then*`. Order:

1. **Each entry point → page loads** — one block per distinct route into the page (from the spec's Navigation > Entry points section). Each block must end with `*And* the main page heading and content should match the [+prototype+|PROTOTYPE_URL]`, where `PROTOTYPE_URL` is the prototype URL from the spec.
2. **Back link** — if the back link destination is always the same regardless of how the user arrived, write one block. If it varies by entry point (e.g. shown on some routes, hidden on others, or pointing to different pages), write one block per distinct case and name the entry point in the `Given` clause. Refer to the destination by its page name only (e.g. "I am taken to the have NRL reference page") — the route is already in the Page URLs section, don't restate it.
3. **Content links** (only if the spec has a `Content link` / `Content links` entry) — see [Content link scenarios](#content-link-scenarios).
4. **Happy path** — valid input → next page. Refer to the destination by its page name only (e.g. "I am taken to the enter email page") — the route is already in the Page URLs section, don't restate it.
5. **Missing value** — empty submission → error summary as shown on the [prototype error state|prototype-url?preview=1&error=1]. Always include this block for a `question page`: empty-submission validation is standard GOV.UK form behaviour even when the spec does not mention it explicitly.
6. **Invalid format** (only if the spec lists a format rule) — bad value → error summary as shown on the [prototype error state|prototype-url?preview=1&error=1]
7. **Entry is re-shown** (only if the spec says the user's previously entered value is restored when they navigate back within the same session) — user navigates back to the page and sees their previously entered value

No blank lines within a block. One blank line between the last step of a block and the next `h3.` heading.

If a prototype error state couldn't be reached, note this and omit that AC block — do not use spec wording as a substitute.

#### Content link scenarios

Write one block per content link in the spec (one block for a single `Content link`, one per bullet under `Content links`), in the order listed. Use the spec's link text only to say which link to select, and the spec's path or full URL as the destination — do not browse to the destination to look up a page name, and do not add the destination to the Page URLs section.

```
h3. Scenario N - Content link to <short description of the destination>
*Given* I am on the <this-page name> page
*When* I select the <spec link text> link
*Then* I am taken to <path or full URL from the spec>
```

Write a path as given in the spec (e.g. `/request-to-use/start`) and a full URL as a Jira link. If the spec's destination is missing for an entry, stop and alert the user rather than guessing.

### Step 4 — Create or update the ticket

- **No existing ticket:** use `create-jira-ticket` with `--summary` and `--description`. Then run `node .ai/skills/tools/confluence/add-jira-link.mjs PAGE_ID JIRA_KEY JIRA_URL` to write the ticket link back to the Confluence spec — this enables future re-runs to detect and update the existing story. If the script fails for any reason, stop and report the exact error; do not work around it by calling the Confluence API directly.
- **Existing ticket key found** (from Step 1 or provided by the user): update the description by piping it to `node .ai/skills/tools/jira/update-ticket.mjs NRF2-XXXX -d -`, then add a comment summarising what changed using `node .ai/skills/tools/jira/add-comment.mjs NRF2-XXXX -`. Do not call `add-jira-link.mjs` — the link is already on the page.

### Step 5 — Review

Use the `jira-story-reviewer` skill with the ticket key from Step 4. If any findings are returned, fix them once by piping the revised description to `node .ai/skills/tools/jira/update-ticket.mjs NRF2-XXXX -d -`. Do not loop — if findings remain after this single fix cycle, report them to the user in Step 6 rather than continuing to revise.

### Step 6 — Report

Return the ticket key and URL, plus a one-line summary of the reviewer outcome (Pass, or how many findings were fixed).


## Non-functional requirements

Every ticket must include an `h2. Non-functional requirements` section, separate from the acceptance criteria.

Use the mapping in [non-functional requirements](../../../docs/ai/non-functional-requirements.md).

Steps:

1. Work from the cached category list above — do **not** fetch the guidance index or child pages on every run. The category name is enough to judge relevance in almost every case (Accessibility, Security, Browser compat and Performance are all self-explanatory for a `question page`).
2. Start from the categories mapped to the ticket's page type in the page-types table of the NFR doc (a `dropout page` or `confirmation page` has no form, so Security is not included). For each category, decide whether it applies given the specifics of the feature spec. Skip a category only when it clearly doesn't apply (e.g. page load performance on an internal admin page behind auth). Briefly note any category you deliberately excluded so the user can push back.
3. If a category name is genuinely ambiguous for the ticket in front of you, fetch that one child page via `read-confluence-page` to read the guidance — but do not paste the guidance into the ticket.
4. In the ticket's `h2. Non-functional requirements` section, list each applicable category as a bullet linking to its Confluence page. Use Jira wiki-markup link syntax, e.g. `* [+Accessibility+|https://eaflood.atlassian.net/wiki/spaces/NRFDT/pages/6538166273/Page-level+accessibility+guidance]`.
5. Append any NFRs listed in the spec's own NFRs section as additional bullets. Spec-listed NFRs are additive — they extend the guidance baseline, they don't override it. Include the spec's wording as text (there is no guidance-page link to reference).
6. List **all** relevant NFRs explicitly in the ticket. Don't skip any on the assumption that "the team always does this" — being explicit is the whole point.
