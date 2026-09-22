---
name: browse-prototype
description: Browse the nature restoration levy prototype to extract content
allowed-tools: Bash, Read, playwright_browser_navigate, playwright_browser_navigate_back, playwright_browser_snapshot, playwright_browser_evaluate, playwright_browser_run_code_unsafe, playwright_browser_click, playwright_browser_type, playwright_browser_fill_form, playwright_browser_press_key, playwright_browser_wait_for, playwright_browser_close, playwright_browser_console_messages, playwright_browser_network_requests, playwright_browser_take_screenshot, mcp__playwright__browser_navigate, mcp__playwright__browser_navigate_back, mcp__playwright__browser_snapshot, mcp__playwright__browser_evaluate, mcp__playwright__browser_run_code_unsafe, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_fill_form, mcp__playwright__browser_press_key, mcp__playwright__browser_wait_for, mcp__playwright__browser_close, mcp__playwright__browser_console_messages, mcp__playwright__browser_network_requests
---

## Parameters

1. **URL** (optional) — the full URL of a prototype page. Defaults to `https://nrf-prototypes.ext-test.cdp.defra.gov.uk/`

## Output format

Produces a JSON array in the same format as `.ai/skills/tools/figma/extract-journey.js` — one object per page extracted. Hold the result in memory for downstream use. Do not write it to a file unless the user asks.

```json
[{
  "metadata": {
    "urlPath": "/path/to/page",
    "title": "Page title",
    "pageType": "form | content | confirmation"
  },
  "content": [
    { "style": "Headings", "level": 1, "text": "..." },
    { "style": "Paragraphs", "text": "..." },
    { "style": "Links", "text": "..." },
    { "component": "Panel", "nunjucksMacro": "govukPanel", "titleText": "...", "text": "..." },
    { "component": "Button", "nunjucksMacro": "govukButton", "text": "..." },
    { "component": "Radios", "nunjucksMacro": "govukRadios", "name": "...", "fieldset": { "legend": { "text": "..." } }, "hint": { "text": "..." }, "items": [{ "value": "...", "text": "..." }] },
    { "component": "Checkboxes", "nunjucksMacro": "govukCheckboxes", "name": "...", "fieldset": { "legend": { "text": "..." } }, "hint": { "text": "..." }, "items": [{ "value": "...", "text": "..." }] },
    { "component": "Text input", "nunjucksMacro": "govukInput", "id": "...", "name": "...", "label": { "text": "..." }, "hint": { "text": "..." } },
    { "component": "Textarea", "nunjucksMacro": "govukTextarea", "id": "...", "name": "...", "label": { "text": "..." }, "hint": { "text": "..." } },
    { "component": "Select", "nunjucksMacro": "govukSelect", "id": "...", "name": "...", "label": { "text": "..." }, "hint": { "text": "..." } },
    { "component": "Date input", "nunjucksMacro": "govukDateInput", "id": "...", "namePrefix": "...", "fieldset": { "legend": { "text": "..." } }, "hint": { "text": "..." } },
    { "component": "File upload", "nunjucksMacro": "govukFileUpload", "id": "...", "name": "...", "label": { "text": "..." }, "hint": { "text": "..." } }
  ],
  "nextSteps": [
    { "action": "Continue", "goToPage": "/next/page/path" }
  ]
}]
```

The `hint` property is omitted when no hint text is present. `nextSteps` is empty when the page has no outgoing navigation (e.g. a confirmation page) or when this skill was only asked to extract a single page — flag this to the user so they can wire navigation manually if needed.

## Step 1: Navigate to the prototype

1. Navigate to the URL using the `browser_navigate` tool.
2. Take a snapshot with the `browser_snapshot` tool to see what loaded.
3. **If the page shows a password prompt** (look for a password `<input>` or any form asking for a password/passphrase), fill it with `nrf-2025-round1!` and submit, then wait for navigation and take a new snapshot to confirm you have reached the prototype.

## Step 2: Extract page content

1. Read the extraction script into memory using the `Read` tool:

   ```
   .ai/skills/tools/prototype/extract-page.js
   ```

2. Pass the file's content verbatim to the `browser_evaluate` tool. It parses the rendered GOV.UK HTML in `<main>` and returns a single-page JSON object in the format above.

   **If the script fails for any reason, stop immediately.** Report the exact error to the user. Do not attempt to rewrite or inline the script.

## Step 3: Capture error states (when requested by caller)

If the caller needs error message text, trigger each validation in the same browser session immediately after Step 2:

1. **Empty submission** — click the Continue button without filling any fields. Take a snapshot. The `govukErrorSummary` will appear; each `<a>` in the error list is the exact error link text to capture.
2. **Invalid format** (only if the caller's spec lists a format rule) — fill the field with a value that matches the input type but fails the format check (e.g. `ABC123` for a field expecting `NRL-123456`). Submit and capture the error summary again.

The error link text in `govukErrorSummary` is the single source of truth for error message wording — do not use the inline field error or the spec wording.

## Step 4: Validate and report

- If the result is `null`, the page has no `<main>` element — stop and report this to the user.
- If `metadata.title` is `null`, inspect the snapshot for an `<h1>` that may have been missed, extract its text manually, and flag it in the summary as needing confirmation.
- Summarise what was extracted: page title, page type, number of content blocks, any components that appear in the snapshot but are absent from the JSON (e.g. summary lists, tables, inset text, warning text — these are not extracted by the script and must be added manually).
- Note any `nextSteps` destinations so the user knows what wiring remains.

## Notes on content not extracted by the script

The extraction script covers the main GOV.UK Design System form and content components. The following patterns are **not** extracted and must be handled manually after running the skill:

| Pattern | What it looks like | How to represent it |
| --- | --- | --- |
| Summary list | `govuk-summary-list` — key/value pairs | Use the `Paragraphs` multi-line `Label: value` shape from the Figma mapping table |
| Inset text | `govuk-inset-text` | Use `{ style: "Paragraphs", text: "..." }` |
| Warning text | `govuk-warning-text` | Use `{ style: "Paragraphs", text: "..." }` |
| Table | `govuk-table` | Not representable in the JSON format — flag to user for manual handling |
| Details / accordion | `govuk-details`, `govuk-accordion` | Not extracted — flag to user |
| Notification banner | `govuk-notification-banner` | Use `{ style: "Paragraphs", text: "..." }` |
| Lists (`<ul>`, `<ol>`) | Bullet or numbered lists | Each list item as a separate `{ style: "Paragraphs", text: "..." }` block |
