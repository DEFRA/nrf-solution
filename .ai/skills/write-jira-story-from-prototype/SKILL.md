---
name: write-jira-story-from-prototype
description: EXPERIMENTAL. Creates or updates a concise Jira story (single-line bold-label numbered acceptance criteria, no Given/When/Then) for a journey page (question, content, check your answers, dropout or confirmation page) from a live prototype URL, with no Confluence spec needed. Use when asked to write a "simple", "short" or "concise" story from a prototype page.
allowed-tools: Read, Bash
model: inherit
skills:
  - browse-prototype
  - read-jira-ticket
  - create-jira-ticket
  - review-jira-story-from-prototype
---

You write a short, scannable Jira story for one journey page, by exploring its live prototype. This is the experimental alternative to `write-jira-story`: same intent, no Confluence spec and much less ceremony.

## Prerequisites

`ATLASSIAN_USER` and `ATLASSIAN_TOKEN` environment variables must be set before running. See [docs/ai/atlassian-credentials.md](../../../docs/ai/atlassian-credentials.md) for setup instructions.

## Input

1. **Prototype URL** (required) - the prototype page being created or altered.
2. **Jira ticket number** (optional), e.g. `NRF2-1381` - an existing ticket to update rather than a new one to create.
3. **Parent key and labels** (optional) - applied when creating a ticket.
4. **Parent feature Confluence page** (optional second parameter, URL or page ID) - the feature spec the page belongs to. Used to link the ticket and the page to each other, and to find the epic (see [Parent feature page](#parent-feature-page)).

The user may also say what is changing if the story alters an existing page (e.g. "add back links"), and may supply Out of scope items, a confirmation page's browser-back destination, and extra entry points.

**Check the URL path begins with `/handoffs`.** If not, the prototype isn't dev-ready: alert the user at the start, but carry on. Use the URL as given, and list the warning first in your report.

## Workflow

1. **Read the ticket** (only with a ticket number): use `read-jira-ticket` on that ticket alone. Treat the story as self-contained: do not read linked, referenced or sibling tickets.
2. **Explore the prototype** (see [Exploring the prototype](#exploring-the-prototype)).
3. **Draft the description** in Jira wiki markup (see [Structure](#structure) and [Jira markup](#jira-markup)).
4. **Self-check** (see [Self-check](#self-check-before-creating-or-updating)).
5. **Create or update the ticket** (see [Create or update](#create-or-update-the-ticket)).
6. **Review** the ticket, fixing findings once.
7. **Report.**

## Parent feature page

Only when a Confluence page was supplied.

1. **Before drafting**, fetch it with `node .ai/skills/tools/confluence/page.mjs PAGE json` and look in the body for a Jira epic link (a `/browse/NRF2-123` URL or a Jira issue macro). If exactly one epic is found, use its key as `--parent` when creating (an explicit parent from the user wins). If none or several are found, don't guess: create without a parent and list it in your report. Use the page only for this; don't mine it for story content.
2. **Description:** add a final line to the description, after Non-functional requirements: `*Feature specification*: [+<page title>+|<page URL>]` (page URL without tracking parameters). Skip it if the description already links the page.
3. **After creating or updating the ticket**, write the ticket link onto the page with `node .ai/skills/tools/confluence/add-jira-link.mjs PAGE JIRA_KEY JIRA_URL`, unless the page already links that key. If the script fails, stop and report the exact error.

## Structure

Sections appear in this order. User story, Acceptance criteria, Page URLs and Non-functional requirements are always present; Out of scope only if it has content.

1. **User story** - three lines:
   ```
   *As a* housing developer
   *I want* <goal>
   *So that* <benefit>
   ```
   The user is always a housing developer at this stage. Make a best guess at the goal and benefit from the page; don't ask the user for them. The user need must match what is observable in scope.

   Directly below, a single line: `*Page type*: question page | content page | check your answers page | dropout page | confirmation page`. Infer it from the prototype page:
   - **question page:** visible form input and a submit button.
   - **content page:** static content with a continue button and a back link, but no form input.
   - **check your answers page:** a `govuk-summary-list` with change links.
   - **dropout page:** no continue button and no visible form input.
   - **confirmation page:** has the GOV.UK panel (CSS class `govuk-panel`), no continue button and no visible form elements.
2. **Acceptance criteria** - `h2. Acceptance criteria`, then a numbered list of single-line scenarios (see below).
3. **Page URLs** - always present. `h2. Page URLs`, then a two-column table: page title, URL. No prototype column (prototype links belong in the ACs). The page being created or altered is always the first row, followed by every other page named in an AC. Every page named in an AC appears here; every other row is the current page.
4. **Out of scope** - leave out by default. It can't be inferred from a prototype. Only include it if the user supplies content (naming the owning ticket's key where another ticket owns an item), or the existing ticket already has it.
5. **Non-functional requirements** - `h2. Non-functional requirements`, always present, never empty. One bullet per applicable category, linked to its guidance page, using [non-functional requirements](../../../docs/ai/non-functional-requirements.md). Start from the categories mapped to the page type in that doc; skip a category only when it clearly doesn't apply, and mention any you excluded in your report. Never list Browser & device compatibility or Page load performance. Security only where the page posts a form (question and check your answers pages), not for content, dropout or confirmation pages. Don't fetch the guidance pages; the category name is enough.

6. **Feature specification** - only when a parent feature page was supplied (see [Parent feature page](#parent-feature-page)).

Do not add: Testing notes, Notes, Context, "Generated from", a separate Prototype line, or Given/When/Then.

### Jira markup

The description is Jira wiki markup, not Markdown:

| Markdown | Jira |
|---|---|
| `**bold**` | `*bold*` |
| `*italic page title*` | `_italic page title_` |
| `[text](url)` | `[+text+\|url]` |
| `- bullet` | `* bullet` |
| `1. numbered item` (acceptance criteria) | `# numbered item` |
| `## Heading` | `h2. Heading` |
| table header row | `\|\|Page title\|\|URL\|\|` then `\|title\|url\|` rows |

A bare external URL in an AC is written as `[+url+|url]`.

## Acceptance criteria rules

- One numbered item per scenario: `# *<Prefix>:* <one sentence>.`. Only the acceptance criteria are numbered; NFRs stay as bullets.
- The bold prefix succinctly describes the scenario and carries the meaning, so the sentence doesn't repeat it. Examples:
  - `*Next page (if Yes selected):* _Page title_` - no need to say "choosing yes and continuing takes the user to".
  - `*Form validation (missing value):*`, and `*Form validation (invalid email):*` for other validations - always name the validation in brackets.
  - `*Show saved selection:*`
  - `*Back link:*`, `*Learn more link:*` - name the link only; the sentence gives the destination (and target, e.g. new tab). Link wording itself is covered by the page content scenario.
- Refer to other pages by title in italics, exactly as the h1 appears in the prototype - never by route, never by spec wording. Routes live in Page URLs only.
- External destinations are stated as a full link in the AC and are not added to Page URLs. All external URLs open in a new tab: say so in the AC, and flag it in your report if the prototype link doesn't do so.
- Don't copy content strings (headings, hints, labels, error text) from the prototype. Link to the prototype instead. The one exception is page titles (the h1), used verbatim in italics.
- Each AC states one behaviour. No "or" joining pages or outcomes, no slashes in place of a word, no ambiguous "it". No blank "valid" - say what valid means if it matters.
- Every AC names where a tester sees the result (a page, or its content via the prototype link), not just "is handled".
- Don't write ACs for behaviour that belongs to a different page or ticket. In particular, for a back link, the AC is only the destination; what the destination page then shows (e.g. restoring a saved answer) is out of scope.
- A link whose prototype href is `#` (a placeholder) still gets its AC, in the normal position for its type. Say the destination is not yet defined, e.g. `*Learn more link:* Not yet defined: the link currently goes nowhere (placeholder `#` in the prototype).` Don't invent a destination. List each one as an open question in your report.
- Include a prototype link in an AC wherever a tester needs to see the content (page content, error states). Destination pages don't need one just to be navigated to. Never add prototype links to Page URLs.
- Use one term consistently for each domain concept, matching the prototype.

### Scenarios for a new question page

In this order, skipping any that don't apply:

1. **Page content** - heading and content match the [prototype](URL).
2. **Back link** - destination page, one AC per distinct entry point if it varies (name the entry point in the prefix, e.g. `Back link (from X)`).
3. **Content links** - one AC per link in the page body, in page order.
4. **Next page** - one AC per distinct outcome: `*Next page (if <option> selected):*` for radios or conditional routing, plain `*Next page:*` if there is only one.
5. **Form validation (<type>)** - one AC per reachable error state, linking the prototype error state.
6. **Show saved selection** - include for every question page, since nearly all question pages remember the answer. Standard wording: `*Show saved selection:* Returning to the page shows the option the user previously saved.` (for checkboxes, "the options"; for a text input, "the value"). Don't say how it is stored (session, database); that is an implementation detail. Omit only if you know the page deliberately doesn't restore answers.

### Scenarios for a new content page

Only these, in this order: **Page content**, **Back link** (as for a question page), **Content links**, **Next page** (the Continue destination; plain `*Next page:*`). No validation or saved selection.

### Scenarios for a new check your answers page

Only these, in this order:

1. **Page content** - heading and summary list match the [prototype](URL).
2. **Back link** - as for a question page.
3. **Change links** - one AC per summary row, in page order: `*Change link (<row label>):*` takes the user to the page for that answer. The row label identifies the row, and the destination page is named by title in italics. Where the destination is a page with its own story, the AC is only that the link goes there; what that page then shows or does is out of scope. Open each link in the prototype to capture the h1.
4. **Content links**
5. **Next page** - the submit or Continue destination. Include a validation scenario only if the prototype has a reachable error state.

No saved selection (the page has no input of its own). Do not describe what each answer row displays beyond the Page content scenario.

### Scenarios for a new dropout page

Only these, in this order: **Page content**, **Back link** (as for a question page), **Content links**. No next page, validation or saved selection. Do not add a scenario for the absence of a Continue button or form.

### Scenarios for a new confirmation page

Only these, in this order:

1. **Page content**
2. **Entry point (from X)** - one AC per page whose form submission leads here: submitting valid details on _X_ takes the user to this page. Capture each from the prototype by submitting the previous page.
3. **Browser back** - the page has no back link, so no back link scenario. The redirect destination can't be inferred from a prototype, so take it from the user; if not supplied, list it as an open question in your report rather than guessing. Name an in-application destination by its page title; state an external destination as the full link.
4. **Content links**

No next page, validation, back link or saved selection.

### Altered pages

For an altered page, include only the scenarios that the change affects.

## Exploring the prototype

Use `browse-prototype` for navigation and password handling. In one browser session:

1. **This page:** capture the h1 (it names the story and the Page URLs row), and determine the page type. For a check your answers page, list each summary row and its change link. Note every content link in the body, including those with a `#` href, where it sits if that affects finding it (e.g. inside a details component), and its destination. A destination in this application is opened to capture its h1; an external one is recorded as a full URL.
2. **Back link:** (all types except confirmation) if present, click it and capture the h1 of the page you land on. If the page can be reached from several places (the user told you, or the prototype shows it), repeat via each entry point. Never guess an entry point you haven't seen. For a confirmation page, confirm there is no back link and note it in the report if there is.
3. **Entry points:** (confirmation page) submit a valid value on each page that leads here, and confirm you land on this page.
4. **Next pages:** (question, content and check your answers pages) for a form, submit a valid value; otherwise just follow Continue/submit; capture the h1. For radios, repeat for every option, returning to the page each time. For checkboxes or conditional reveals, test the combinations that route differently. If a destination redirects to a sign-in, record it as unverified rather than guessing.
5. **Form validation:** (question page; check your answers only if the prototype has an error state) append `?preview=1&error=1` to the page URL to load the empty-submission error state. Confirm it renders an error summary; link it from the AC. Then submit invalid values the form plausibly checks (format, length, range) to discover other error states. Prototype error URLs for specific validations are unknown unless seen, so state when you couldn't reach one and leave it out rather than inventing a URL or message.
6. **Saved answer:** (question page) the prototype may not persist state, so don't rely on it; include **Show saved selection** for any question page (see above).

Keep the extraction output out of the story and your notes: you only need each page's h1, and confirmation that each error state and content link is reachable, not the full JSON.

Page routes: the default is `<prefix>/<last path segment of the prototype URL>` (e.g. `.../latest/variation` becomes `/request-to-use/variation`), for the current page and for destination pages you opened. The prefix comes from the prototype URL: `nrf-quote` in it gives `/quote`; `nrf-request-to-use` in it gives `/request-to-use`; anything else gives `/journey-page`. These may not match the real app, so if the frontend routes (e.g. `frontend/src/server/request-to-use/`) or the user give a different route, use that. Say in your report that routes were defaulted from the prototype.

Prototype URLs for related pages follow `.../handoffs/<prototype-name>/latest/<slug>?preview=1`. Only link a prototype page you have opened. A prototype link that redirects (302) probably needs a sign-in; say it couldn't be checked rather than assuming it loads.

## Self-check before creating or updating

- Sections are in the right order; omitted sections are omitted, not empty. NFRs are present.
- The ACs are a numbered list; the NFRs are bullets.
- The Page type line sits directly under the user story and matches the prototype page.
- Every AC prefix is a short description, bold, and the sentence doesn't repeat it.
- No Given/When/Then, no routes in ACs, no copied prototype content, no "or".
- The scenarios match the page type (no form scenarios on dropout or confirmation pages).
- Every page named in an AC is in Page URLs, and vice versa; the current page is the first row; the table has no prototype column.
- Every external link says it opens in a new tab.
- Every question page has Show saved selection.
- Every link to a page in this application has been opened, or is listed as unverified. External links are recorded as full URLs and need not be opened.
- Every ticket key in the description is a Jira link, mentioned once, and differs from the ticket being written. Strip tracking parameters from URLs.
- Markup is Jira wiki markup, not Markdown.

## Create or update the ticket

- **No ticket number:** use `create-jira-ticket` with `--summary` and `--description`, plus `--parent` (the user's, else the epic found on the parent feature page) and `--labels` if given, and always `--sprint Sausage` (new tickets only; an updated ticket keeps its sprint). The summary is the exact prototype h1 suffixed with "page", e.g. "Is the development an amendment to an existing planning permission? page". Without a parent feature page there is nothing to link back to; with one, follow step 3 of [Parent feature page](#parent-feature-page).
- **Ticket number given:** pipe the description to `node .ai/skills/tools/jira/update-ticket.mjs NRF2-XXXX -d -`, then add a comment summarising what changed with `node .ai/skills/tools/jira/add-comment.mjs NRF2-XXXX -`. Keep the existing summary, parent and labels (carry over an existing Feature specification line too). Carry over only Out of scope items, NFRs and ticket links from the old description; everything else it held (Notes, Context, Testing notes, Given/When/Then ACs) is dropped. Name the dropped content in the comment.

If a script fails for any reason, stop and report the exact error; don't work around it.

## Review

Review the ticket with the `review-jira-story-from-prototype` skill and its key. Fix every finding once by piping the revised description to `update-ticket.mjs`. Do not loop. Report any findings that remain.

## Report

Return the ticket key and URL, then in a few short lines:

- the reviewer outcome (Pass, or how many findings were fixed and any that remain);
- routes that were defaulted from the prototype;
- assumptions made (user story, Show saved selection);
- anything you couldn't verify (unreached error states, unchecked entry points, links needing sign-in, links that don't open in a new tab), and open questions (e.g. a confirmation page's browser-back destination, links with a `#` placeholder href, an epic that couldn't be determined from the parent feature page);
- NFR categories you excluded.
