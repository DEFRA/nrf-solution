# HTML coding guidelines

## Date formatting

All dates displayed to users must use the GOV.UK date format: day month-name year with no leading zero on the day (e.g. "5 June 2025", not "05/06/2025").

- Format dates in the Nunjucks template, not in the controller or service layer — controllers must pass raw date values (ISO strings or Date objects) to the view
- Use a Nunjucks filter or macro to apply the format (e.g. `{{ application.createdAt | govukDate }}`); do not pre-format dates in JavaScript before passing them to `h.view()`
- Defining the filter: add a `govukDate` filter to the Nunjucks environment in the server setup (or reuse one already defined in the project) that converts the value using `Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })` or equivalent
- If the value is null, undefined, or an invalid date, the filter must return a hyphen `–` rather than throwing or rendering a fallback epoch date
- When a time component is needed, use the pattern `d MMM yyyy 'at' HH:mm` (e.g. "8 Sep 2026 at 08:35") — use the standard 3-letter month abbreviation (`Sep`, not `Sept`), and format in local time (not UTC)

## Links

- Anchors in page content must carry the `govuk-link` class — a bare `<a href="...">` misses GOV.UK link styling (colour, focus state, visited state)
- Link hrefs to other pages in the service come from the view model (e.g. `href="{{ boundaryTypePath }}"`, populated from `routePath` imports), never hard-coded paths — see the Route paths rule in [javascript.md](./javascript.md)

## GTM / analytics

See the [analytics skill](../../.claude/skills/analytics/SKILL.md) for gate conditions, custom event patterns, and testing conventions.

## Accessibility

### GOV.UK Frontend JS initialisation

GOV.UK Frontend components that require JavaScript (e.g. `NotificationBanner`, `Accordion`, `Tabs`) must have their JS module initialised on every page that renders them. The standard pattern is `initAll()` in the page's script bundle, or targeted `new ComponentName(el).init()` calls.

- A notification banner on a success/confirmation page that is not initialised will not receive `tabindex="-1"` from the JS module, so focus will not move to it after a PRG redirect — keyboard-only and screen-reader users will not know the action succeeded.
- When reviewing: confirm that any page using a GOV.UK Frontend JS-dependent component calls `initAll()` (or the targeted constructor) in its client-side script.

### Asynchronously loaded content

Any content that loads or updates asynchronously after the initial page render must be announced to screen-reader users. Use one of these patterns:

- Add `aria-live="polite"` (or `aria-live="assertive"` for urgent content) to the container element **before** the content loads — live regions only announce changes that occur after they are in the DOM.
- Alternatively, move focus to the container's heading or the updated region once the async operation completes.

A `role="region"` alone is not sufficient — it does not cause screen readers to announce dynamic content changes. When reviewing: flag any element whose content is populated asynchronously (API call, polling redirect, form submission response) that has neither an `aria-live` attribute nor programmatic focus management.

## GOV.UK design system components reference

Use macros to render GOV.UK design system components, rather than raw HTML, so that we pick up changes to the component HTML structure automatically.

| Component     | CSS class pattern     | Macro reference                                                                               |
| ------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| Button        | `govuk-button`        | https://design-system.service.gov.uk/components/button/#button-example-nunjucks               |
| Error message | `govuk-error-message` | https://design-system.service.gov.uk/components/error-message/#error-message-example-nunjucks |
| Error summary | `govuk-error-summary` | https://design-system.service.gov.uk/components/error-summary/#error-summary-example-nunjucks |
| Radios        | `govuk-radios`        | https://design-system.service.gov.uk/components/radios/#radios-example-nunjucks               |
| Checkboxes    | `govuk-checkboxes`    | https://design-system.service.gov.uk/components/checkboxes/#checkboxes-example-nunjucks       |
| Panel         | `govuk-panel`         | https://design-system.service.gov.uk/components/panel/#panel-example-nunjucks                 |
| Table         | `govuk-table`         | https://design-system.service.gov.uk/components/table/#table-example-nunjucks                 |

### Tables

Every `govukTable` call must include a `caption` and `captionClasses` parameter. Without a caption the table has no programmatic label — screen reader users navigating by table list cannot distinguish one table from another, which fails WCAG 2.1 SC 1.3.1 (Level A).

```njk
{{ govukTable({
  caption: "Descriptive table name",
  captionClasses: "govuk-visually-hidden",
  head: [...],
  rows: [...]
}) }}
```

Use `govuk-visually-hidden` when a visible heading immediately above the table already labels it — the caption is still read by screen readers but does not duplicate the heading visually. Use `govuk-table__caption--m` (or `--s`) only when no surrounding heading provides that label.
