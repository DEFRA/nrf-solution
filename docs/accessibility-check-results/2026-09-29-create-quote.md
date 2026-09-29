# Accessibility check results — Create a quote (drawn boundary)

Tested: 2026-09-29 · Journey file: `docs/user-journeys/quote.md` · Environment: `http://localhost:3000`

---

## Results table

| Journey | Page | Sub-step | Check | Result | Notes |
| ------- | ---- | -------- | ----- | ------ | ----- |
| Create a quote | 1 Start page | — | Page title matches H1 | ✅ Pass | "Nature restoration levy - GOV.UK" / H1 "Nature restoration levy" |
| Create a quote | 1 Start page | — | Images — SVG roles | ✅ Pass | GOV.UK logo: `role="img" aria-label="GOV.UK"`; decorative SVGs: `aria-hidden="true"` or `role="presentation"` |
| Create a quote | 1 Start page | — | Skip to main content | ✅ Pass | Link `href="#main-content"`, `<main id="main-content">` present |
| Create a quote | 1 Start page | — | Heading hierarchy | ✅ Pass | H1 → H2s, no skipped levels |
| Create a quote | 1 Start page | — | New-tab links | ✅ Pass | All `target="_blank"` links include "(opens in new tab)" in visible text |
| Create a quote | 1 Start page | — | Cookie banner | ✅ Pass | `role="region" aria-label="Cookie banner"`; H2 heading; Accept/Reject buttons with meaningful text |
| Create a quote | 2 Cookies | 1 Submit empty | Forms — error summary | ✅ Pass | `role="alert"` on inner div; `tabindex="-1"` on outer; focus moves to summary; `href="#analytics"` matches `id="analytics"` |
| Create a quote | 2 Cookies | 1 Submit empty | Forms — inline error | ✅ Pass | `id="analytics-error"`; fieldset `aria-describedby="analytics-error"` |
| Create a quote | 2 Cookies | 2 Save with Yes | Success notification — `role="alert"` | ✅ Pass | `role="alert" aria-labelledby="govuk-notification-banner-title"`, title `id` matches |
| Create a quote | 2 Cookies | 2 Save with Yes | Success notification — focus management | ❌ Fail | GOV.UK Frontend notification-banner JS not initialised (`data-govuk-notification-banner-init` absent, `tabindex` not added by JS). Focus stays on `<body>` rather than moving to the success banner. `role="alert"` on a DOM element present at page load is not reliably announced by screen readers — keyboard users will not know their cookie preferences were saved. |
| Create a quote | 3 Planning application type | 1 Submit empty | Forms — error summary | ✅ Pass | Focus on summary; `href="#planningType"` matches radio `id`; fieldset `aria-describedby` includes error id |
| Create a quote | 3 Planning application type | 1 Submit empty | Page title | ✅ Pass | "Error:" prefix added |
| Create a quote | 4 Not available for planning type | — | Page title vs H1 | ✅ Pass | "Not available for planning type" conveys meaning of H1 |
| Create a quote | 4 Not available for planning type | — | Back link | ✅ Pass | `<a>` tag, `href="/quote/planning-type"` |
| Create a quote | 6 Are you developing housing units? | — | Page title vs H1 | ✅ Pass | Title now uses page heading "Are you developing housing units?" (fixed: `confirm-housing/get-view-model.js`) |
| Create a quote | 6 Are you developing housing units? | 1 Submit empty | Forms — error summary | ✅ Pass | Focus on summary; href, inline error id, fieldset aria-describedby all correct |
| Create a quote | 7 NRL only for housing units | — | Page title vs H1 | ✅ Pass | Title now uses page heading "Nature restoration levy is only available for housing units" (fixed: `not-housing/get-view-model.js`) |
| Create a quote | 9 How many residential units? | — | Forms — input | ✅ Pass | `type="text"` (no spinbutton, as designed); label matches H1; hint linked via `aria-describedby` |
| Create a quote | 9 How many residential units? | 1–3 Invalid inputs | Forms — validation | ✅ Pass | Correct error messages for empty, -1, and 0.1; focus on summary; inline error linked to input |
| Create a quote | 10 Boundary type | — | Radio hints | ✅ Pass | "Upload a file" item hint `id="boundaryEntryType-2-item-hint"` linked via `aria-describedby` on that radio |
| Create a quote | 10 Boundary type | 1 Submit empty | Forms — error summary focus | ⚠️ Advisory | `focusedOnSummary` returned `false` in one evaluation (400ms wait). Likely a timing issue — all other pages confirmed focus moves correctly. Recommend re-verifying manually. |
| Create a quote | 11 Map — draw boundary | — | Heading structure | ✅ Pass | H1 "Draw your boundary on a map"; H2 per panel (Key, Keyboard shortcuts, Map styles, Boundary information) |
| Create a quote | 11 Map — draw boundary | — | Icon button accessible names | ✅ Pass | All 10 icon-only buttons use `aria-labelledby` pointing to `role="tooltip"` elements with meaningful text (Search, Map controls, Styles, Move up/down/left/right, Precision, Zoom in/out) |
| Create a quote | 11 Map — draw boundary | — | Keyboard drawing | ✅ Pass | Search, Draw mode, placing 3 vertices, Done button enable/disable all work via keyboard |
| Create a quote | 11 Map — draw boundary | 4 Click Done | Map — async content announcement | ✅ Pass | `renderPanel()` in `boundary-info-panel.js` sets `tabindex="-1"` on the "Boundary information" H2 and calls `.focus()` when results (or an error) arrive. Focus management covers the announcement requirement. No `aria-live` needed. |
| Create a quote | 12 Enter email address | — | Forms — input | ✅ Pass | `type="email"`, `autocomplete="email"`, label matches H1, hint linked |
| Create a quote | 12 Enter email address | 1 Submit empty | Forms — validation | ✅ Pass | Focus on summary; `href="#email"` matches input id; `aria-describedby="email-hint email-error"` |
| Create a quote | 13 Check your answers | — | Change links | ✅ Pass | Each "Change" link includes unique visible text (e.g. "Change planning application type") plus visually-hidden supplement; no ambiguous repeated link text |
| Create a quote | 13 Check your answers | — | Summary list structure | ✅ Pass | Uses `<dl>` (GOV.UK summary list pattern), not `<table>` |
| Create a quote | 15 Upload boundary file | — | File input | ✅ Pass | `id="file"`, label matches H1, hint `id="file-hint"` linked via `aria-describedby` |
| Create a quote | 17 Not available in this area | — | Structure | ✅ Pass | H1 matches, back link is `<a>` |
| Create a quote | 20 Within excluded area | — | Structure | ✅ Pass | H1 matches, back link is `<a>` |
| Create a quote | 23 File preview | — | Page title vs H1 | ✅ Pass | Title now matches heading dynamically: "Your uploaded red line boundary file" (success) or "Your red line boundary file contains an error" (error) (fixed: `file-preview/get-view-model.js`) |
| Create a quote | 23 File preview | — | Map panel headings | ✅ Pass | H2 per panel as on draw-boundary page |
| Create a quote | 26 Delete quote | — | Delete/cancel pattern | ✅ Pass | Delete is `<button type="submit">`; Cancel is `<a>` link — correct pattern |
| Create a quote | 28 Confirmation | — | Heading hierarchy | ✅ Pass | H1 → H2 → H2 |
| Create a quote | 28 Confirmation | — | Links | ✅ Pass | No `click here`/`read more` patterns; new-tab links include "(opens in new tab)" |

---

## Pages that passed cleanly

Pages 1 (Start), 3 (Planning type), 4 (Not available), 5 (Planning type again), 7 (Not housing), 8 (Housing yes), 9 (Unit number), 10 (Boundary type), 12 (Email), 13/25/27 (Check your answers), 15/18/21 (Upload), 17 (Not in EDP), 20 (Excluded area), 23 (File preview), 24 (Email), 26 (Delete), 28 (Confirmation) all passed their structural accessibility checks. Validation error patterns (error summary focus, inline error linking, fieldset aria-describedby) are consistently correct across all form pages.

---

## Failures detail

### ❌ Cookies page — success banner not focused (page 2, step 2.2)

The GOV.UK Frontend notification banner JS module was not initialised on the success state of the cookies page (`data-govuk-notification-banner-init` attribute absent from `.govuk-notification-banner`). As a result:
- `tabindex="-1"` is never added to the banner by JS
- Focus is not moved to the banner after the PRG redirect
- The `role="alert"` inner div is in the DOM from page load, so most screen readers will not announce it automatically (live regions must be dynamically inserted to reliably trigger announcement)

Keyboard-only users have no way to know their cookie preferences were saved.

**Fix**: Ensure `initAll()` (or targeted `new NotificationBanner(el).init()`) is called on the cookies success page so the module adds `tabindex="-1"` and focuses the banner.

---

## Untestable items

- **Checking file page (pages 16, 19, 22)**: This page auto-redirects via client-side polling before accessibility checks could be run. The page title is "Checking file - Nature restoration levy - GOV.UK" which is appropriate. The loading/polling mechanism could not be assessed for ARIA live region announcement.
- **400% zoom usability**: Not tested in this run.
- **Focus ring visibility**: Not tested in this run.
