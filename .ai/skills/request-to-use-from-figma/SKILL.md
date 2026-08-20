---
name: request-to-use-from-figma
description: Extract a node/screen from a Figma prototype file and generate a working page (view, view model, form validation, routes) from it. Use when the user provides a Figma file key and wants a page built from a Figma design.
---

## Parameters

1. **Figma file URL or file key** — either a full Figma URL, e.g. `https://www.figma.com/design/jWozIjlRIH7yhjvGqleEwi/NRF-flows?node-id=866-14029&t=A221TfI61JzZ0077-4`, or a bare file key, e.g. `jWozIjlRIH7yhjvGqleEwi`. If given a URL, extract the file key as the path segment immediately after `/design/` or `/file/` (up to the next `/`). A `node-id` query parameter, if present, identifies a single frame/page within the file — pass it through to the extract script (see Step 1.1) so only that one page is fetched and extracted, rather than the whole file.
2. **Route ID** e.g. `file-upload`. Used as the folder name for the generated page files (`frontend/src/server/request-to-use/<route-id>`).

## Terms

- 'target folder' — the folder below `frontend/src/server/request-to-use` named after the route ID, e.g. `frontend/src/server/request-to-use/email-confirmation`

## Step 1: Extract the journey JSON

1. Run the extract script from the repo root, using the extracted file key (see Parameters above). If the input URL had a `node-id` query parameter, pass it as a second argument exactly as it appears in the URL (dashes and all — the script converts `-` to `:` itself):

   ```bash
   node .ai/skills/tools/figma/extract-journey.js <file-key> [node-id]
   ```

   When `node-id` is given, the script fetches only that single node/frame and writes a JSON object for it — it does not walk the whole file, so `nextSteps` will always be empty for this page (there's no full page list to resolve navigation targets against).

   Requires a `FIGMA_TOKEN` environment variable. If it is not set in the current shell, it may still be defined in the user's shell profile (e.g. `~/.zshrc`) but not yet loaded — try `source ~/.zshrc` (or the user's shell profile) and re-check before giving up. If it is still not set after that, stop immediately and tell the user: _"Please set the FIGMA_TOKEN environment variable and retry."_

2. **If the script fails for any reason, stop immediately.** Report the exact error to the user. Do not attempt to call the Figma API directly or guess the file structure.

3. Hold the resulting JSON object in memory.

## Step 2: Generate the page

Refer to the existing example in `frontend/src/server/request-to-use/nrl-reference` to see all the file types that should be created.
Do not create form validation, or tests - these are prototype pages.

### Create a nunjucks page

Generate a Nunjucks view file at `{target folder}/index.njk`. Use `frontend/src/server/request-to-use/nrl-reference` as an example.

The generated `index.njk` must:

- Extend `layouts/page.njk`
- Define `{% block pageTitle %}` as `{{ pageTitle }}`, or (if the page has any field-component block) `{% if validationErrors %}Error: {% endif %}{{ pageTitle }}`
- Include a `{% block beforeContent %}` with `{{ backLink({href: backLinkPath}) }}` — **except** on a confirmation page (`metadata.pageType === "confirmation"` / content contains a `Panel` component): omit `beforeContent` entirely, matching GOV.UK convention of no back link after a completed action. See `frontend/src/server/quote/confirmation/index.njk` for a worked example (reference the file for markup style only — its own `controller-get.js`/`get-view-model.js` fetch real backend data via a query-string reference and are not part of this skill's pattern; keep using `requestToUseController`/`quotePostController` and the placeholder-driven view model described below)
- **Wiring the back link and next-page destination into the wider journey is out of scope for this skill.** Where the journey JSON doesn't say what the previous or next page is (e.g. a single-node extraction, where `nextSteps` is always empty — see Step 1.1), don't ask the user to supply real route paths. Leave `backLinkPath` as the `'#'` placeholder (see "Create a view model" below) and `get-next-page.js` returning a placeholder path, and just build the page itself. Note in the summary to the user that wiring these paths into the journey needs manual follow-up.
- Wrap content in `<div class="govuk-grid-row"><div class="govuk-grid-column-two-thirds-from-desktop">…</div></div>`
- Define `{% block content %}` by converting the `content` array **in order** (see mapping below)
- For Nunjucks macro imports, check `layouts/page.njk` first; add there if missing, not in the page's own file

### Content block → markup mapping

Walk the page's `content` array in order and convert each block:

| Block shape | Output |
| --- | --- |
| `{ style: "Headings", level: 1, text, caption }` | This is the page H1 — render as `{{ pageHeading }}` (not the literal Figma text) inside `<h1 class="govuk-heading-l">`. If `caption` is present, add `<span class="govuk-caption-l">{{ caption }}</span>` immediately before it (or fold into a `govuk-fieldset__legend`/page-heading pattern if the block is really the form's legend — see Forms below) |
| `{ style: "Headings", level, text }` (not the first heading) | `<h{level} class="govuk-heading-{l\|m\|s}">{{ text }}</h{level}>` — `level: 2` → `govuk-heading-m`, `level: 3` → `govuk-heading-s` |
| `{ style: "Paragraphs", text }`, single line, no internal `\n` | `<p class="govuk-body">{{ text }}</p>` |
| `{ style: "Paragraphs", text }`, multiple `\n`-separated lines that each read as `Label: value` (at least two consecutive lines matching this shape) | Treat as a `govukSummaryList` (already imported globally): one row per line, `{ key: { text: <label> }, value: { text: <value> } }`, split on the first `:` |
| `{ style: "Paragraphs", text }`, multiple `\n`-separated lines that don't match the summary-list shape | A `\n` here can mean either a real paragraph/list-item break, or just a cosmetic wrap inside one sentence (Figma text boxes wrap at a fixed width, which shows up as `\n` in the raw text). Check each line: if it ends without terminal punctuation (`.`, `:`, `?`, `!`) and the next line continues in lowercase, they're one wrapped sentence — join them with a space rather than splitting. Only give a line its own `<p class="govuk-body">` where it's a genuinely distinct, grammatically-complete statement (or a list-style item). If you can't tell wrapped-continuation from distinct-line apart confidently, don't guess — render the whole block as one paragraph (lines joined with spaces) and flag it in the summary as needing a manual check |
| `{ style: "Paragraphs", text }`, single line containing 2+ segments separated by runs of 2+ spaces, where at least one (but not all) segments end in a `Label:` prefix (e.g. `"Email: x@y.com  Telephone: 000  Monday to Friday, 8:30am to 5pm"`) | A contact-details line — render as one `<p class="govuk-body">` with each segment on its own line, joined by `<br>`. See the `Email:`/`Telephone:`/opening-hours block in `frontend/src/server/quote/confirmation/index.njk` for the exact pattern to copy |
| `{ style: "Links", text }` | `<p class="govuk-body"><a href="#" class="govuk-link">{{ text }}</a></p>` |
| `{ component: "Panel", nunjucksMacro: "govukPanel", titleText, text }` | This is a confirmation page's H1 equivalent — same rule as the H1 `Headings` row: call `{{ govukPanel({ titleText: pageHeading, text: text }) }}`, using `pageHeading` rather than the literal `titleText` string. See `frontend/src/server/quote/confirmation/index.njk` |
| Any other `{ component, nunjucksMacro, ...params }` | Call `{{ <nunjucksMacro>({ ...params }) }}` directly — the block's own properties already match that macro's real parameters (verified against https://design-system.service.gov.uk/components/), so pass them straight through. E.g. `{ component: "Button", nunjucksMacro: "govukButton", text: "Continue" }` → `{{ govukButton({ text: "Continue" }) }}` |

### Content pages built from freeform Figma text (no named heading/body layers)

Some Figma frames — especially document-like "content" pages (certificates, letters, terms) — are authored as one or a few freeform text layers rather than distinct `Content: Heading` / `Content: Body` layers. The extractor splits these on blank lines, but a single text layer can still land as one `Paragraphs` block that runs together what should visually be several elements (sub-headings, key/value pairs, table rows), especially where the only separator in the source is a double-space or a single `\n` rather than a blank line. Two specific fallbacks:

- **Missing page heading:** if `metadata.title` is `null` and there's no `{ style: "Headings", level: 1 }` block, look at the first `Paragraphs` block. If it's a single short line with no terminal full stop (reads like a title, not a sentence), promote it to `pageHeading`/`pageTitle` instead of leaving them blank, and say so explicitly in the summary to the user as an inferred heading that needs confirming — it wasn't authored as a real heading layer in Figma.
- **Un-splittable ambiguous blocks:** if a `Paragraphs` block clearly mixes several distinct topics/headings/table-like rows (e.g. a wall of text with double-spaces standing in for paragraph breaks, or a run of short standalone lines that look like table column headers followed by row content) and you can't confidently split it without guessing, don't invent markup for it. Render it using the multi-line paragraph fallback above (or as a single paragraph if it has no line breaks at all) and list it explicitly in the summary as needing manual restructuring — name which block(s), and what you suspect they should become (e.g. "likely a table — columns: X, Y, Z"). This is the same "flag rather than guess" approach as branching `nextSteps` and missing journey links.

### Forms

If the page's `content` array contains any field-component block (`nunjucksMacro` one of `govukRadios`, `govukCheckboxes`, `govukInput`, `govukTextarea`, `govukSelect`, `govukDateInput`, `govukFileUpload`):

- Wrap the content in `<form method="post" novalidate>` with `{% include "partials/csrf-token.njk" %}` as the first line inside the form (see `nrl-reference/index.njk`)
- If a field's legend/label text is the same as the page H1 (common when the `Headings` block and the field's `legend`/`label` text match), use a `{% set legendHtml %}<h1 class="govuk-fieldset__heading">{{ pageHeading }}</h1>{% endset %}` and pass `legend: { html: legendHtml, classes: "govuk-fieldset__legend--l" }` instead of a separate `<h1>` — see `nrl-reference/index.njk`
- Prefix `pageTitle` with `{% if validationErrors %}Error: {% endif %}`

### Create a view model

Create `get-view-model.js` in the target folder with a named default export returning:

- `pageTitle` — `metadata.title` + `' - Gov.uk'`
- `pageHeading` — `metadata.title`
- `backLinkPath` — `'#'`

If `metadata.title` is `null`, use the inferred heading from "Content pages built from freeform Figma text" above instead — don't leave `pageHeading`/`pageTitle` blank or undefined.

### Create a 'get next page' file (if the page has any field-component block)

Create `get-next-page.js` with a named default export function that accepts the form payload and returns the next route path. Use the page's `nextSteps` (from the journey JSON) to determine the destination — if `nextSteps` has more than one entry (a branching journey), the routing logic depends on the submitted value and should be worked out with the user rather than guessed. If `nextSteps` is empty (always the case for a single-node extraction — see Step 1.1), don't ask the user for the real destination — return a placeholder path (e.g. `'#'`) and flag it in the summary as needing manual follow-up, per the note in "Create a nunjucks page" above.

### Create a route file

Create `routes.js` — same pattern as in `frontend/src/server/request-to-use/nrl-reference`: a GET route always, a POST route if the page has a form. Route path format: `/request-to-use/<route-id>`.

Import and spread the routes into `frontend/src/server/request-to-use/index.js`.
