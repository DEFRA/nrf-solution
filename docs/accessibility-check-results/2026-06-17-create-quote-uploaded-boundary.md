# Accessibility audit — Create a quote (uploaded boundary)

**Date:** 2026-06-17  
**Environment:** https://nrf-frontend.test.cdp-int.defra.cloud  
**Journey:** Create a quote (uploaded boundary)  
**Tool:** Playwright MCP + manual JS evaluation

---

## Pages that passed cleanly

- **Page 2 (Boundary type)** — validation, error summary focus, field associations all correct. Confirmed consistent with drawn boundary journey.
- **Page 3 (Upload a red line boundary file)** — file input has label (`for="file"`), hint via `aria-describedby="file-hint"`, `accept` attribute lists correct formats. Standard `govuk-file-upload` pattern.
- **Page 4 (Boundary file upload status)** — redirected automatically before accessibility checks could be run (scan completed in under 1 second). No issues observed during the brief load.
- **Page 5 (Boundary Map)** — heading structure correct (single h1 "Boundary Map"), skip link and `#main-content` target present, zoom buttons labelled via `aria-labelledby` referencing tooltip elements, EDP results in a `govuk-list--bullet` list, all links have meaningful text.

---

## Failures

| Journey | Page | Sub-step | Check | Result | Notes |
|---------|------|----------|-------|--------|-------|
| Create a quote (uploaded boundary) | All pages | — | Page title — service name suffix | ❌ Fail | Title suffix is `"Gov.uk"` (mixed case) rather than `"GOV.UK"` throughout the service — consistent with drawn boundary journey |
| Create a quote (uploaded boundary) | 5 Boundary Map | Initial load | Page title — descriptive enough | ⚠️ Warning | Title and h1 are both "Boundary Map" — this is generic. If a user navigates back and forward between pages the browser history will show duplicate "Boundary Map" titles for both this page and potentially others. Consider "Review your boundary" or similar to make it uniquely identifiable |

---

## Notes

- The **upload status page** (Page 4, `/quote/upload-received`) redirected before a full snapshot could be captured. If the scan takes longer in other scenarios (larger files, slower network), the polling/waiting state of that page should be audited separately — in particular checking whether the auto-redirect is announced to screen readers before navigation occurs.
- The **Boundary Map page** is read-only (no drawing capability), so keyboard drawing checks do not apply.
- **"Draw the boundary on a map instead"** is correctly implemented as a `<button type="submit">` (form action), not a link — appropriate since it triggers a server action.
- The **EDP list item** uses `<br>` to separate the EDP name from the overlap percentage within a single `<li>`. This is readable by screen readers as a single text run with a brief pause; no semantic issue.
- Boundary type page (Page 2) checks are **identical** to the drawn boundary journey — no new issues found.
