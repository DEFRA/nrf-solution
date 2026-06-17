# Accessibility audit — Create a quote (drawn boundary)

**Date:** 2026-06-16  
**Environment:** https://nrf-frontend.test.cdp-int.defra.cloud  
**Journey:** Create a quote (drawn boundary)  
**Tool:** Playwright MCP + manual JS evaluation

---

## Pages that passed cleanly

- **Page 1 (Start page)** — single h1, skip link and target present, new-tab link labelled, SVG arrow correctly `aria-hidden`
- **Page 2 (Boundary type)** — validation, error summary focus, field associations, item-level hint on radio all correct
- **Page 4 (Type of development)** — fieldset hint via `aria-describedby`, error state all correct
- **Page 5 (Residential units)** — label, hint, error association all correct
- **Page 6 (Maximum number of people)** — label, hint, error association all correct
- **Page 7 (Enter email address)** — `type="email"`, `autocomplete="email"`, label, hint, error association all correct
- **Page 8 (Check your answers)** — all Change links have visually-hidden context text
- **Pages 10–14 (Return journey form pages)** — consistent with first pass

---

## Failures

| Journey | Page | Sub-step | Check | Result | Notes |
|---------|------|----------|-------|--------|-------|
| Create a quote (drawn boundary) | All pages | — | Page title — service name suffix | ❌ Fail | Title suffix is `"Gov.uk"` throughout; should be `"GOV.UK"` |
| Create a quote (drawn boundary) | 3 Map | Initial load | Map — keyboard drawing | ❌ Fail | Canvas has `tabindex="-1"` and is not keyboard-focusable. No keyboard mechanism found for drawing, editing or deleting a boundary. Checklist requires all three operations to be keyboard-operable. |
| Create a quote (drawn boundary) | 3 Map | Styles panel open | Landmarks — duplicate region label | ❌ Fail | Two `[role="region"]` elements share `aria-label="Draw a red line boundary"` simultaneously; screen readers announce both identically with no way to distinguish them |
| Create a quote (drawn boundary) | 3 Map | Styles panel open | Landmarks — unlabelled `<aside>` | ❌ Fail | Map styles panel renders as `[role="complementary"]` with no `aria-label`; WCAG requires each landmark of the same type to have a unique accessible name |
| Create a quote (drawn boundary) | 3 Map | After drawing shape | Map — async content focus | ❌ Fail | When a boundary is drawn and the "Boundary information" panel populates, its `<h2>` heading has no `tabindex` and focus is not moved to it. The `[role="status"]` carries a generic area-size message, not a signal that the panel has updated. Screen reader users receive no indication the panel is ready. |
| Create a quote (drawn boundary) | 3 Map | After deleting shape | Map — async deletion announcement | ❌ Fail | After clicking Delete, the `[role="status"]` region retains the previous area text ("New area approximately 0.6 miles by 2.9 miles") and does not announce the deletion. No focus movement or live-region update occurs. |
| Create a quote (drawn boundary) | Waste water treatment works (between pages 6 and 7) | Initial load | Forms — input hint association | ❌ Fail | Radio `#wasteWaterTreatmentWorks-19` (last option) has no `aria-describedby`; all other 18 radios have item-level hint associations via `aria-describedby` |
| Create a quote (drawn boundary) | 15 Confirmation | — | Links — non-functional placeholder | ❌ Fail | "Find out about call charges" has `href="#"` — a placeholder that does nothing; should link to the GOV.UK call charges page or be removed |

---

## Notes

- The **waste water treatment works** page is not listed in the journeys file but appears in the actual flow between pages 6 (maximum number of people) and 7 (email address).
- The **cookie banner `<h2>`** appearing before the page `<h1>` in DOM order is the standard GOV.UK pattern (the banner has its own `role="region"`); this is acceptable.
- All **error summary patterns** (focus on submission, `Error:` title prefix, summary link targets matching field IDs, inline error `aria-describedby`) are correctly implemented on every form page tested.
- The **Beta phase banner** and feedback link (`opens in new tab` labelling) are correct throughout.
