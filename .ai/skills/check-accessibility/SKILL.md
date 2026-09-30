---
name: check-accessibility
description: Run the service's accessibility checklist over a user-journeys file or a single page in the browser, and write a dated results report.
allowed-tools: Bash, Read, playwright_browser_navigate, playwright_browser_navigate_back, playwright_browser_snapshot, playwright_browser_evaluate, playwright_browser_run_code_unsafe, playwright_browser_click, playwright_browser_type, playwright_browser_fill_form, playwright_browser_press_key, playwright_browser_wait_for, playwright_browser_close, playwright_browser_console_messages, playwright_browser_network_requests, playwright_browser_take_screenshot, mcp__playwright__browser_navigate, mcp__playwright__browser_navigate_back, mcp__playwright__browser_snapshot, mcp__playwright__browser_evaluate, mcp__playwright__browser_run_code_unsafe, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_fill_form, mcp__playwright__browser_press_key, mcp__playwright__browser_wait_for, mcp__playwright__browser_close, mcp__playwright__browser_console_messages, mcp__playwright__browser_network_requests, mcp__playwright__browser_take_screenshot
---

# Check accessibility

## Parameters

`args` is a path to a **journeys markdown file** (by default use docs/user-journeys/quote.md), or a single URL to a page to test.

Each numbered step within a journey is a separate page.

For each page, if there are specified sub-steps then execute each step and check the accessibility of the resulting page state. After the last step, continue to the next page.
If a page has "- skip" then just click through it and don't check accessibility

> **Setup:** when testing deployed environments (e.g. `*.cdp-int.defra.cloud`), add a real-browser `--user-agent` to your Playwright MCP server args in `~/.claude.json` — otherwise the bot filter serves blank pages to Playwright's headless UA. See `test-in-browser/SKILL.md` for the exact value.

## Flow

If `args` is a single URL rather than a journeys file: navigate to it, run the checklist once (no sub-steps), and save the report to `docs/accessibility-check-results/YYYY-MM-DD-single-page.md`. Skip the numbered steps below.

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

**File naming:** `YYYY-MM-DD-<journey-name>.md` where `<journey-name>` is the journey's `#` heading lowercased, with parentheses and other punctuation stripped and spaces replaced by hyphens (e.g. `# Create a quote (drawn boundary)` → `YYYY-MM-DD-create-a-quote-drawn-boundary.md`). Use today's date.

<!-- Example row — replace with actual findings: -->

| Journey | Page | Sub-step | Check | Result | Notes |
| ------- | ---- | -------- | ----- | ------ | ----- |
| Create a quote (drawn boundary) | 2 Boundary type | 1 Submit with no option | Forms — error summary | ❌ Fail | summary link `href` `#type` doesn't match field `id` `boundary-type` |

## Accessibility checklist

### All page types

- page title should be unique within the service & suffixed with service name. It should exactly match or describe the meaning of the h1 heading
- Images have alt text — descriptive for content images, `alt=""` for decorative ones; never omit the attribute. SVG icons used as buttons have an `aria-label`.
- Pages are usable at 400% zoom without horizontal scrolling on a 1280-px viewport. No fixed pixel widths on text containers. *Manual check:* resize the browser to 320 × 768 px (equivalent to 400% on a 1280-px screen) and look for horizontal overflow.

### Headings

- Every page has only one `<h1>` which matches the page's question or task.
- Heading levels are sequential — no jumping from `<h1>` straight to `<h3>`.
- Headings convey structure, not styling: never a bold or enlarged paragraph standing in for a heading.

### Forms

- Every form input has an associated label via `<label for="…">`. Placeholder text is not a label.
- Fieldset-level hint text should be associated with the fieldset via `aria-describedby`. Form input level hint text should be associated with the input via `aria-describedby`.

#### Validation errors

To trigger form validation, submit the form without selecting an option or entering a value. Then assess the page accessibility after it reloads.
- Errors are exposed twice: in an error summary at the top of the page (as a list of links to the offending fields) and inline next to each field via an error message. Field IDs in the summary links `href` match the field's `id` exactly.
- The inline error message for a form fieldset is associated with it (aria-describedby on the fieldset)
- Focus is managed: keyboard focus moves to the error summary when a form page reloads with a validation error. Verify via `document.activeElement` — it should be the error summary container or a child of it.

### Tables

- Table heading cells use `<th>` with `scope` set to `"col"` or `"row"`
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

#### Keyboard technique for the draw-boundary map

Many map buttons have zero bounding-box dimensions and **must be activated via `.evaluate(el => el.click())`** — Playwright's standard `locator.click()` times out on them. Use `keyboard.press` for arrow keys and Enter once focus is on the map.

**Selector reference:**

| Interaction | How to target |
|---|---|
| Open search panel | `getByRole('button', { name: 'Search', exact: true })` → `.evaluate(el => el.click())` |
| Search input | `getByRole('combobox', { name: 'Search' })` → `pressSequentially(query)` |
| Select a search result | `getByRole('option', { name: /^Aylsham(,|$)/i }).first()` → wait for visible → `.click()` |
| Key panel | `getByRole('button', { name: 'Key', exact: true })` |
| Open map styles panel | `getByRole('button', { name: 'Styles', exact: true })` → `.evaluate(el => el.click())`; panel opens as a drawer |
| Select a map style | Within the styles panel: `getByRole('button', { name: 'Satellite' })` (or the style name) → `.evaluate(el => el.click())` |
| Start drawing | `getByRole('button', { name: 'Draw', exact: true })` → `.focus()` → `keyboard.press('Enter')`; wait for Cancel button to confirm drawing mode |
| Place a vertex | `keyboard.press('Enter')` |
| Pan between vertices | Arrow keys (~15 presses between points) |
| Done button | `getByRole('button', { name: 'Done' }).and(locator(':not([aria-disabled="true"])'))` — `aria-disabled="true"` until ≥3 distinct spaced vertices |
| Open Draw tools menu | `getByRole('button', { name: 'Draw tools', exact: true })` → `.evaluate(el => el.click())`; opens a popup menu with Draw polygon / Edit feature / Delete feature |
| Edit feature | After opening Draw tools: `getByRole('menuitem', { name: 'Edit feature' })` → `.evaluate(el => el.click())`; `aria-disabled` until a shape exists; wait for Cancel to confirm edit mode |
| Delete feature | After opening Draw tools: `getByRole('menuitem', { name: 'Delete feature' })` → `.evaluate(el => el.click())`; `aria-disabled` until a shape exists |
| Save and continue (map/file-preview) | `.evaluate(el => el.click())` then `waitForURL(/\/quote\/.../, { waitUntil: 'commit' })` — `locator.click()` times out here because lingering tile fetches hold the load event |
| Back (map page only) | `getByRole('button', { name: 'Back' })` — this is a `<button>`, not a link |
| Back (all other pages) | `getByRole('link', { name: 'Back', exact: true })` — `exact: true` avoids matching "give your feedback" in the phase banner |

**Sequence for a full draw-boundary test:**

1. **Wait for map to load** — after navigating to the page, wait ~2 s before interacting.
2. **Search** — `.evaluate` click Search button; type into the combobox; wait for results; click the matching option. Confirm the map has panned.
3. **Change map style (optional)** — `.evaluate` click Styles button; then `.evaluate` click the style option (e.g. Satellite).
4. **Enter draw mode** — `.focus()` the Draw button, then `keyboard.press('Enter')`. Confirm Cancel button is present before proceeding.
5. **Draw a triangle** — `keyboard.press('Enter')` for first vertex; ~15 ArrowRight presses then Enter for second; ~15 ArrowDown presses then Enter for third. Wait for `aria-disabled` to be removed from Done.
6. **Click Done** — `.evaluate` click Done. Boundary information panel should appear.
7. **Edit feature (optional)** — `.evaluate` click Draw tools, then Edit feature. Move a vertex with arrow keys, then Done. Boundary info should update.
8. **Delete feature (optional)** — `.evaluate` click Draw tools, then Delete feature. Boundary info panel should clear.
9. **Save and continue** — `.evaluate` click the button; `waitForURL` with `{ waitUntil: 'commit' }`.

#### checking-file auto-redirect

The checking-file page polls the server and redirects client-side. `waitForURL` and `waitForFunction` both time out even though the redirect succeeds. After clicking Continue on the upload page, use a fixed wait then read `page.url()` directly:

```js
await page.getByRole('button', { name: 'Continue' }).click()
await page.waitForTimeout(500) // let checking-file appear
await page.waitForTimeout(15000) // allow scan + redirect to complete
const url = page.url() // verify expected destination
```

#### Housing units input

The unit-number input does not carry a `spinbutton` ARIA role. Target it by ID: `page.locator('#housingUnits')`.

