---
name: journey-page
description: >
  Create or modify a journey page in nrf-frontend (any area under frontend/src/server/: quote,
  manage, request-to-use). Read before creating or modifying any journey page. Given a Jira page
  story (question page, dropout page or confirmation page) it builds the page from the live
  prototype in the browser: view, view model, form validation, navigation, routes and tests.
  conventions.md in this folder is the reference for how each file is written.
---

## Use

- **From a Jira page story** (e.g. `NRF2-1262`): follow all the steps below. The ticket is the spec; there are no other parameters.
- **Without a ticket** (modifying an existing page, or a custom prompt): follow [conventions.md](./conventions.md) only.

## Scope

This skill builds the page, its form validation and its navigation (content links, back link and the redirect after a successful submit). Session management is out of scope and handled by a separate ticket (NRF2-1270): saving answers, re-showing saved answers, clearing them, guards, and redirecting when there is no session. Do not add session helpers, session keys, guards or state handling, and do not write tests for them. The validation-error flash used by the standard PRG flow (see Controllers in [conventions.md](./conventions.md)) is part of form validation and is in scope.

Do not commit, push, open PRs, or edit the Jira ticket.

## Terms

- 'page story' - a Jira ticket whose description has a `Page type:` line.
- 'page type' - one of `question page`, `dropout page`, `confirmation page`.
- 'area' - the first segment of the page's route, e.g. `quote` for `/quote/planning-type`. It maps to a folder and Hapi plugin under `frontend/src/server/`.
- 'route ID' - the last segment of the page's route, e.g. `planning-type`. It is also the target folder name.
- 'target folder' - `frontend/src/server/<area>/<route ID>`.

## Step 0: Read and validate the ticket

1. Use the `read-jira-ticket` skill with the ticket key. Its output is HTML (`<b>`, `<h3>`, `<a href>`), not Jira wiki markup.
2. Extract, from the description:
   - **Page type**. If it is missing or not one of the three supported types, stop and tell the user.
   - **Page URLs section**: the route of 'this page', the name and route of each previous page, and the name and route of each next page. Names are the exact h1s of those pages.
   - **Prototype URL**: the link in the Scenario 1 line `the main page heading and content should match the prototype`. Use links inside the acceptance criteria only; ignore any prototype link outside the AC section. If Scenario 1 has no such link, stop and tell the user.
   - **Error state URLs** (`question page` only): the `prototype error state` links in the Missing value / Invalid format scenarios.
   - **Content link scenarios**: for each `Content link to ...` scenario, the link text named in the `When` line and the destination in the `Then` line (a path, or a full URL).
   - **Happy path scenarios** (`question page` only): which option or value leads to which next page.
   - **Session scenarios** (for example an answer being re-shown, answers being cleared, or being redirected to the start page when visiting directly) and the **browser back scenario** (`confirmation page`): out of scope (see Scope); list them in the final report.
3. Derive the area and route ID from the route of 'this page'. The area decides the target folder, the GET and POST controllers (see Controllers in [conventions.md](./conventions.md)) and the `index.js` the routes are registered in. Stop and tell the user, rather than creating anything, if the area folder, its `index.js` or its `controller-get.js` does not exist.
4. Check which of the previous and next pages already exist in `frontend/src/server/` (a folder with `route-path.js`, or a legacy page without one). Record this: it decides between importing a `routePath` and using a literal route string, and which neighbouring pages need updating in Step 2.
5. Check the target folder does not already exist. If it does, stop and ask the user, offering to resume by reviewing the existing files against this skill, the ticket and the prototype instead of overwriting them.

## Step 1: Read the prototype page

1. Follow Step 1 of the `browse-prototype` skill (navigate, handle a password prompt) with the prototype URL.
2. Run `mcp__playwright__browser_evaluate` with `() => document.querySelector('main')?.outerHTML` and keep the result. If it is `null`, stop and tell the user. This HTML is the source of truth for markup, classes, field names, option values, labels, hints and links. Do not use the `extract-page.js` script - it drops inline links, lists and other markup.
3. Read the h1 text. This is the page heading. It should match the 'this page' name in the Page URLs section; if it does not, flag it in the final report.
4. `question page` only: navigate to each error state URL from the ticket, run the same evaluate call, and read the text of every `.govuk-error-summary__list a`. These are the exact error messages for `form-validation.js`. Do not submit the form to find them. If an error state URL is missing or has no error summary, use a sensible placeholder message and list the field in the final report.
5. Check the prototype is consistent with the page type, and stop and tell the user if not:
   - `dropout page` and `confirmation page`: no `<form>` and no Continue button.
   - `question page`: has a form.
   - `confirmation page`: no back link.
   - `dropout page` and `question page`: has a back link.

## Page types

|                                                            | question page                        | dropout page        | confirmation page   |
| ---------------------------------------------------------- | ------------------------------------ | ------------------- | ------------------- |
| Form, `form-validation.js`, `get-next-page.js`, POST route | yes                                  | no                  | no                  |
| Back link (`beforeContent` block and `backLinkPath`)       | yes                                  | yes                 | **no**              |
| Tests                                                      | page, form-validation, accessibility | page, accessibility | page, accessibility |

- Content links apply to any page type, when the ticket has them.
- Dropout and confirmation pages are GET-only. Model them on `quote/not-housing` (dropout) and `quote/delete-quote-confirmation` (confirmation).
- Back link destination: the previous page's route from the Page URLs section. If that route is only a redirect (e.g. `/` redirecting to `/manage/start-page`), link straight to the redirect's final destination and list the substitution in the final report. For a question or dropout page with more than one previous page, the back link is conditional - stop and ask the user how to decide between them. A confirmation page has no back link, so several previous pages are simply several entry points; they only matter for updating neighbouring pages.

## Step 2: Build the files

Create each file in the target folder following [conventions.md](./conventions.md), with these values taken from the ticket and prototype:

- **`index.njk`**: generated from the `<main>` HTML captured in Step 1 (everything outside `<main>` is handled by the layout). The heading becomes `{{pageHeading}}`; recognised components become macros.
  - **Links:** for each content link in the ticket, find the link whose text matches the link text named in the scenario and set its `href` to the ticket's destination. Replace every other `href` with `#` (except `mailto:`, kept as-is). Keep `target` / `rel` attributes and "(opens in new tab)" text exactly as in the prototype. If a content link from the ticket can't be found in the page, don't guess; list it in the final report.
  - **Form fields:** field names come from the prototype `name` attributes, and radio/checkbox values from the prototype `value` attributes.
- **`get-view-model.js`**: `pageHeading` is the prototype h1; `backLinkPath` is the previous page's route (see Page types).
- **`form-validation.js`**: error messages are the error summary link text read from the prototype error state pages. Map the Missing value scenario to `'any.required'` (and `'any.only'` for radios/checkboxes, `'string.empty'` for text inputs), and the Invalid format scenario to the format key such as `'string.email'`.
- **`get-next-page.js`**: based on the ticket's happy path scenarios and next-page routes. With several next pages, branch on the submitted value, matching the option named in each scenario to the radio `value`. Pages that don't exist yet get a literal route string, listed in the final report.
- **`routes.js` / `route-path.js`**: register the routes in the area's `index.js`.
- **Neighbouring pages**: if the ticket's previous or next pages already exist, update them as described in conventions.md, and list them in the final report.
- **Tests**: one or more per acceptance criteria scenario in the ticket (except the out-of-scope ones): entry point (heading and title), back link, content links, and for a question page each happy path outcome and the error states, plus the form validation unit tests and the accessibility test.

## Finish

Run the new tests (including the form validation tests) and the frontend lint, and fix any failures. If something still fails after two fix attempts, stop and report the failure rather than continuing. Then output a report listing, clearly:

- Files created and the routes registered.
- Any **literal route strings** used for pages that don't exist yet (file and string), to be swapped for `route-path.js` imports when those pages are built.
- Any links left as `#`, and any content links from the ticket that could not be matched in the prototype page.
- Any placeholder error messages that need replacing.
- Any mismatch between the ticket and the prototype (e.g. h1 differing from the Page URLs name), and any back link substitution.
- Neighbouring pages updated.
- Any session scenarios in the ticket that were not implemented (re-shown answers, clearing, redirects when there is no session, browser back), as they are handled by a separate ticket.
- For a question page outside `quote`: which POST controller was used, and that it saves nothing.
