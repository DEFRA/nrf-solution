---
name: check-accessibility
description: Test a page in the browser against accessibility standards.
tools: Bash, Read, mcp__playwright__browser_navigate, mcp__playwright__browser_navigate_back, mcp__playwright__browser_snapshot, mcp__playwright__browser_evaluate, mcp__playwright__browser_run_code_unsafe, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_fill_form, mcp__playwright__browser_press_key, mcp__playwright__browser_wait_for, mcp__playwright__browser_close, mcp__playwright__browser_console_messages, mcp__playwright__browser_network_requests
---

# Check accessibility

## Parameters

`args` is a path to a **journeys markdown file** (by default look in docs/user-journeys folder), or a single URL to a page to test.

Each numbered step within a journey is a separate page.

For each page, if there are specified sub-steps then execute each step and check the accessibility of the resulting page state. After the last step, continue to the next page.
If a page has "- skip" then just click through it and don't check accessibility

> **Setup:** when testing deployed environments (e.g. `*.cdp-int.defra.cloud`), add a real-browser `--user-agent` to your Playwright MCP server args in `~/.claude.json` — otherwise the bot filter serves blank pages to Playwright's headless UA. See `test-in-browser/SKILL.md` for the exact value.

## Flow

1. Read the journeys file from `args`.
2. For each journey:
   - Navigate to the journey's URL with `mcp__playwright__browser_navigate`.
   - For each page in order:
     - Confirm the expected page loaded via `mcp__playwright__browser_snapshot`.
     - Run the accessibility checklist (below) on the page. Prefer `mcp__playwright__browser_evaluate` for precise assertions; use `mcp__playwright__browser_snapshot` to discover unknown selectors.
     - If the page has sub-steps, perform each one in order and re-run the checklist on the resulting page state after each.
     - After the last sub-step, continue to the next page.
3. After all journeys, close the browser with `mcp__playwright__browser_close`.

If a sub-step can't be performed or a page doesn't load, record the failure and stop that journey — do not retry silently. Report the exact error. Continue with the next journey.

## Output format

A results table with one row per failed check, grouped by journey and page (and sub-step where relevant). List pages that passed cleanly in a brief line; detail every failure with the offending element and the rule it breaks. Write the results table to a markdown file and save to `docs/accessibility-check-results` folder.

| Journey | Page | Sub-step | Check | Result | Notes |
| ------- | ---- | -------- | ----- | ------ | ----- |
| Create a quote (drawn boundary) | 2 Boundary type | 1 Submit with no option | Forms — error summary | ❌ Fail | summary link `href` `#type` doesn't match field `id` `boundary-type` |

## Accessibility checklist

### All page types

- page title should be unique within the service & suffixed with service name. It should either match or match the meaning of the h1 heading
- Images have alt text — descriptive for content images, `alt=""` for decorative ones; never omit the attribute. SVG icons used as buttons have an `aria-label`.
- Pages are usable at 400% zoom without horizontal scrolling on a 1280-px viewport. No fixed pixel widths on text containers.
- Images have alt text - `alt=""` should not be used on content images (it must be descriptive); every image should have either a descriptive or empty `alt`

### Headings

- Every page has only one `<h1>` which matches the page's question or task.
- a logical heading hierarchy (no skipping `<h1>` to `<h3>`). 
- Headings convey structure, not styling. Use `##`, `###`, in order; never bold-as-heading.

### Forms

- Every form input has an associated label via `<label for="…">`. Placeholder text is not a label.
- Fieldset-level hint text should be associated with the fieldset via `aria-describedby`. Form input level hint text should be associated with the input via `aria-describedby`.

#### Validation errors

To trigger form validation, submit the form without selecting an option or entering a value. Then assess the page accessibility after it reloads.
- Errors are exposed twice: in a error summary at the top of the page (as a list of links to the offending fields) and inline next to each field via an error message. Field IDs in the summary links `href` match the field's `id` exactly.
- The inline error message for a form fieldset is associated with it (aria-describedby on the fieldset)
- Focus is managed: keyboard focus moves to the error summary on validation failure; focus returns to the trigger when a modal closes; focus is never trapped.

### Tables

- Table heading cells use `<th scope="col|row">`
- complex tables use `<caption>`
- Layout-via-`<table>` is forbidden - tables should only be used for data presentation, not layout.

### Keyboard navigation

- The focussed element has a yellow outline
- Tabbing moves focus through the page
- All links and form controls are operable with a keyboard
- There should be a link at the very top of the page allowing you to skip to the main content and jump past the top navigation

### Links
- Links have meaningful text — never `click here`, `read more`, `link`.
- For repeated links eg 'Change' in Check your answers pages, visually-hidden text should be used to make the link text unique on the page for screen readers, eg (`Change <span class="govuk-visually-hidden">boundary type</span>`).
- All links use `<a/>` tags
- Links that open in a new tab have text to indicate that

### Map
- If the map supports drawing, the user should be able to draw / edit / delete a boundary using the keyboard
- If a page does an async update to content then either the change should be announced in an ARIA region, or focus should be sent to that panel subheading so the user can continue from there
- On page load, the functionality available on the different map panels should be clear to the user via the heading structure

