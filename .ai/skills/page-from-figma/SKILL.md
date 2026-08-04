---
name: page-from-figma
description: Extract a user journey from a Figma prototype file, save it as JSON, and generate a working page (view, view model, form validation, routes, tests) from it. Use when the user provides a Figma file key and wants a page built from a Figma design.
---

## Parameters

1. **Figma file URL or file key** — either a full Figma URL, e.g. `https://www.figma.com/design/jWozIjlRIH7yhjvGqleEwi/NRF-flows?node-id=866-14029&t=A221TfI61JzZ0077-4`, or a bare file key, e.g. `jWozIjlRIH7yhjvGqleEwi`. If given a URL, extract the file key as the path segment immediately after `/design/` or `/file/` (up to the next `/`). A `node-id` query parameter, if present, identifies a single frame/page within the file — pass it through to the extract script (see Step 1.1) so only that one page is fetched and extracted, rather than the whole file.
2. **Route ID** e.g. `file-upload`. Used as the JSON output filename (`docs/user-journeys/figma/<route-id>.json`) and as the folder name for the generated page files (`frontend/src/server/quote/<route-id>`).

## Terms

- 'target folder' — the folder below `frontend/src/server/quote` named after the route ID, e.g. `frontend/src/server/quote/file-upload`
- 'journey JSON' — the array written to `docs/user-journeys/figma/<route-id>.json` by the extract script. Each element is one Figma page/frame with `metadata` (`urlPath`, `title`, `pageType`) and a `content` array of blocks.

## Step 1: Extract the journey JSON

1. Run the extract script from the repo root, using the extracted file key (see Parameters above). If the input URL had a `node-id` query parameter, pass it as a second argument exactly as it appears in the URL (dashes and all — the script converts `-` to `:` itself):

   ```bash
   node .ai/skills/tools/figma/extract-journey.js <file-key> [node-id]
   ```

   When `node-id` is given, the script fetches only that single node/frame and writes a one-element journey array for it — it does not walk the whole file, so `nextSteps` will always be empty for this page (there's no full page list to resolve navigation targets against). When `node-id` is omitted, the script fetches and walks the entire file as before, producing one array element per page/frame with `nextSteps` populated from the file's navigation graph.

   Requires a `FIGMA_TOKEN` environment variable. If it is not set in the current shell, it may still be defined in the user's shell profile (e.g. `~/.zshrc`) but not yet loaded — try `source ~/.zshrc` (or the user's shell profile) and re-check before giving up. If it is still not set after that, stop immediately and tell the user: _"Please set the FIGMA_TOKEN environment variable and retry."_

2. **If the script fails for any reason, stop immediately.** Report the exact error to the user. Do not attempt to call the Figma API directly or guess the file structure.

3. Move the output to the correct destination:

   ```bash
   mkdir -p docs/user-journeys/figma
   mv figma-journey.json docs/user-journeys/figma/<route-id>.json
   ```

4. If the resulting JSON array contains more than one page (only possible when no `node-id` was given), **ask the user** which page to build (or whether to build all of them, using each page's own `metadata.urlPath` as its route ID) rather than guessing. Do not silently pick the first one.

## Step 2: Generate the page

This mirrors `page-from-prototype`, but the source is already-structured JSON instead of raw HTML — most of the guesswork that skill needs (matching CSS classes to the right macro) is unnecessary here, because each content block already carries the exact macro name and macro-shaped parameters produced by the extract script.

### Create a nunjucks page

Generate a Nunjucks view file at `{target folder}/index.njk`. Use `frontend/src/server/quote/start/index.njk` as the example for a simple content page, and `frontend/src/server/quote/boundary-type/index.njk` for a page with a form.

The generated `index.njk` must:

- Extend `layouts/page.njk`
- Define `{% block pageTitle %}` as `{{ pageTitle }}`, or (if the page has any field-component block) `{% if validationErrors %}Error: {% endif %}{{ pageTitle }}`
- Include a `{% block beforeContent %}` with `{{ backLink({href: backLinkPath}) }}`, **unless** this is the first page in the journey (no incoming `nextSteps` from another page) — the start of a journey has no back link, matching `start/index.njk`
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
| `{ style: "Paragraphs", text }` | `<p class="govuk-body">{{ text }}</p>` |
| `{ style: "Links", text }` | `<p class="govuk-body"><a href="#" class="govuk-link">{{ text }}</a></p>` |
| `{ component: "Error summary", ... }` | **Do not render literally.** See Forms below — it becomes the standard dynamic `{% if validationErrors %}` block, and its `errorList` text is a source of real validation copy for `form-validation.js`, not static markup |
| Any other `{ component, nunjucksMacro, ...params }` | Call `{{ <nunjucksMacro>({ ...params }) }}` directly — the block's own properties already match that macro's real parameters (verified against https://design-system.service.gov.uk/components/), so pass them straight through. E.g. `{ component: "Button", nunjucksMacro: "govukButton", text: "Continue" }` → `{{ govukButton({ text: "Continue" }) }}` |

### Forms

If the page's `content` array contains any field-component block (`nunjucksMacro` one of `govukRadios`, `govukCheckboxes`, `govukInput`, `govukTextarea`, `govukSelect`, `govukDateInput`, `govukFileUpload`):

- Wrap the content in `<form method="post" novalidate>` with `{% include "partials/csrf-token.njk" %}` as the first line inside the form (see `boundary-type/index.njk`)
- Add a dynamic error summary above the rest of the content: `{% if validationErrors %} {{ govukErrorSummary({ titleText: "There is a problem", errorList: validationErrors.summary }) }} {% endif %}` — this replaces any literal `Error summary` block found in the JSON
- If a field's legend/label text is the same as the page H1 (common when the `Headings` block and the field's `legend`/`label` text match), use a `{% set legendHtml %}<h1 class="govuk-fieldset__heading">{{ pageHeading }}</h1>{% endset %}` and pass `legend: { html: legendHtml, classes: "govuk-fieldset__legend--l" }` instead of a separate `<h1>` — see `boundary-type/index.njk`
- For each field-component macro call, in addition to the JSON's own properties, add:
  - `errorMessage: validationErrors.messagesByFormField.<fieldName>` — `fieldName` is the block's `name` (or `namePrefix` for Date input)
  - Pre-selection of the previous submission: `value: formSubmitData.<fieldName>` for Radios/Text-input-like fields, `values: formSubmitData.<fieldName>` for Checkboxes (array). Skip this for File upload — a file input can't be pre-filled.
  - Do not set an `id` on individual Radios/Checkboxes `items`
- Prefix `pageTitle` with `{% if validationErrors %}Error: {% endif %}`

**File upload is a special case.** The real file-upload page in this codebase (`upload-boundary/index.njk`) integrates with a separate uploader service (`uploadUrl`, `multipart/form-data`, an `uploadError` state distinct from Joi `validationErrors`) rather than plain Joi validation — this can't be inferred from Figma content alone. If the page contains a `govukFileUpload` block, generate the macro call and note clearly in the summary to the user that the upload integration (route, controller, `uploadUrl`) needs manual follow-up, referencing `upload-boundary/` as the pattern to copy.

### Sourcing real validation error messages

The JSON's `Error summary` block (if present) is the equivalent of the "content markdown" lookup in `page-from-prototype` — it's where real validation copy comes from, not something rendered as-is:

- If the page has exactly one field-component block and the `Error summary` block has exactly one `errorList` entry, use that entry's `text` as the real error message for that field in `form-validation.js`.
- If there are multiple fields and the mapping from error message to field isn't unambiguous, or there's no `Error summary` block at all, fall back to placeholder messages (e.g. `'Select an option'`, `'Enter a value'`) and — exactly as `page-from-prototype` does — display a clearly visible warning at the end of the skill output listing every field whose error message is a placeholder that needs replacing.

### Create a view model

Create `get-view-model.js` in the target folder with a named default export returning:

- `pageTitle` — `metadata.title` + `' - Gov.uk'`
- `pageHeading` — `metadata.title`
- `backLinkPath` — `'#'` (omit entirely if this page has no back link, per the index.njk rule above)

### Create a form validation file (if the page has any field-component block)

Create `form-validation.js` in the target folder — same rules as `page-from-prototype`'s Joi schema section (Radios/Select, Checkboxes, Text inputs required/optional, Email, Number), applied per field-component block:

- **Radios / Select**: `joi.string().valid(...allowedValues).required()`, `allowedValues` = the block's `items[].value`. Handle `'any.required'` and `'any.only'`.
- **Checkboxes**: `joi.array().items(joi.string().valid(...allowedValues)).single().required()`, same `allowedValues` source. Handle `'any.required'` and `'any.only'`.
- **Text input / Textarea**: `'string.empty'` + `'any.required'` if required; `joi.string().allow('')` if optional (always include optional fields in the schema).
- **Select**: as Radios.
- **File upload**: `joi.any().required().messages({ 'any.required': '...' })` — see `upload-boundary/form-validation.js`; the real content-format validation (GeoJSON/KML/shapefile) happens outside Joi in this codebase, not in this file.

Use the block's `name` (or `namePrefix`) as the schema key. Where the same message is used more than once, extract it to a named `const` (see `boundary-type/form-validation.js`).

### Create a form validation unit test (if the page has any field-component block)

Create `form-validation.test.js` — same rules as `page-from-prototype`: one test per valid value, a test for the field absent, a test for an unrecognised value (Radios/Checkboxes/Select), and an `optional fields` describe block if there are optional text fields. Run the tests and confirm they pass.

### Create a 'get next page' file (if the page has any field-component block)

Create `get-next-page.js` with a named default export function that accepts the form payload and returns the next route path. Use the page's `nextSteps` (from the journey JSON) to determine the destination — if `nextSteps` has more than one entry (a branching journey), the routing logic depends on the submitted value and should be worked out with the user rather than guessed. If `nextSteps` is empty (always the case for a single-node extraction — see Step 1.1), don't ask the user for the real destination — return a placeholder path (e.g. `'#'`) and flag it in the summary as needing manual follow-up, per the note in "Create a nunjucks page" above.

### Create a route file

Create `routes.js` — same pattern as `page-from-prototype`: a GET route always, a POST route if the page has a form. Follow `start/routes.js` (no form) or `boundary-type/routes.js` (form) for the pattern. Route path format: `/quote/<route-id>`.

Import and spread the routes into `frontend/src/server/quote/index.js`.

### Create a page test

Create `page.test.js` — same rules as `page-from-prototype`: assert the H1, `document.title`, and back link `href` (skip the back-link assertion if this page has none). If the page has a form, add the same validation-error-display, valid-submit-redirect, invalid-submit-redirect, CSRF-token, and remembered-selection tests described in `page-from-prototype`, using `expectFieldsetError` / `expectInputError` from `frontend/src/test-utils/assertions.js`.

### Create an accessibility test

Create `accessibility.test.js` — same pattern as `page-from-prototype` (`start/accessibility.test.js` for no form, `boundary-type/accessibility.test.js` for a form, submitting with a mocked validation error first).
