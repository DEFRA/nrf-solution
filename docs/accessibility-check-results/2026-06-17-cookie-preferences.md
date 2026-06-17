# Accessibility audit — Cookie preferences

**Date:** 2026-06-17  
**Environment:** https://nrf-frontend.test.cdp-int.defra.cloud  
**Journey:** Cookie preferences  
**Tool:** Playwright MCP + manual JS evaluation

---

## Notes on journey execution

- The cookie banner ("View cookies" link, sub-step 1.1) was not visible because a prior session had already accepted cookies — the preference cookie is HttpOnly and cannot be cleared via JS. The cookies page was reached via the footer "Cookies" link instead, which is functionally equivalent.
- The start page itself passed all checks (single h1, skip link present, no poor links, new-tab link labelled).

---

## Pages that passed cleanly

- **Page 1 (Start page)** — single h1, skip link and `#main-content` target present, no poor links, new-tab link labelled ✓
- **Page 2 (Cookies) — baseline state** — heading hierarchy correct (h1 → h2 → h3), fieldset/legend/label structure correct, table `<th scope="col">` on all column headers, radio labels associated via `for`, `aria-describedby` on fieldset correctly references error id on validation ✓

---

## Failures

| Journey | Page | Sub-step | Check | Result | Notes |
|---------|------|----------|-------|--------|-------|
| Cookie preferences | All pages | — | Page title — service name suffix | ❌ Fail | Title uses `\|` separator and "Nature Restoration Fund" as service suffix: `"Cookies on Nature Restoration Fund \| Nature Restoration Fund"`. All other service pages use ` - Gov.uk` suffix. Inconsistent with the rest of the service. |
| Cookie preferences | 2 Cookies | 1 Submit with no option | Page title — Error prefix | ❌ Fail | On validation failure the title remains `"Cookies on Nature Restoration Fund \| Nature Restoration Fund"` — no `"Error:"` prefix. All other form pages in the service add `"Error:"` to the title on validation failure. |
| Cookie preferences | 2 Cookies | 2 Select Yes and save | Focus management — success notification | ❌ Fail | After saving, `document.activeElement` is `<body>`. GOV.UK Frontend's `govuk-notification-banner--success` should programmatically move focus to the banner (by adding `tabindex="-1"` and calling `.focus()`), but the banner has no `tabindex` attribute and focus is not moved. Keyboard and screen reader users will not have their focus positioned at the success message. |
| Cookie preferences | 2 Cookies | 2 Select Yes and save | Headings — hierarchy on success state | ❌ Fail | The success notification banner contains an `<h2>` ("Success") which appears in the DOM before the page's `<h1>` ("Cookies on Nature Restoration Fund"). This creates an illogical heading order where h2 precedes h1. |
