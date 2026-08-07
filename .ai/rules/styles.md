# Styling guidelines

## Use GOV.UK utility classes over custom CSS

Prefer GOV.UK Design System classes to custom CSS rules for typography, spacing, and colour, even in bespoke components that don't otherwise use standard GOV.UK page layout.

- Headings must use a `govuk-heading-*` class (e.g. `govuk-heading-s` for 19px) rather than a custom class with a hand-rolled `font-size`/`font-weight`.
- Body text must use a `govuk-body-*` class (e.g. `govuk-body-s` for 16px) rather than a custom class with a hand-rolled `font-size`.

This keeps bespoke UI (e.g. panels rendered inside third-party components like the interactive map) visually consistent with the rest of the service, and means future GOV.UK Frontend upgrades update these components automatically.

## Use GOV.UK SASS helpers

- Always use the GOV.UK SASS spacing helpers (`govuk-spacing($n)`, or the `govuk-!-margin-*`/`govuk-!-padding-*` override classes — see https://design-system.service.gov.uk/styles/spacing/) instead of hard-coded pixel values for margin and padding.
- Always use GOV.UK colours (`govuk-colour("...")`, or the design tokens/CSS custom properties GOV.UK Frontend exposes) instead of hard-coded hex values, so colours stay in sync with the design system's palette.

## Use GOV.UK breakpoint mixins

Always use the GOV.UK Frontend SASS breakpoint mixins for responsive styles rather than hard-coded pixel values:

```scss
// ✅ Correct: use GOV.UK breakpoint mixins
.app-component {
  padding: govuk-spacing(3);

  @include govuk:media-query(tablet) {
    padding: govuk-spacing(5);
  }
}

// ❌ Avoid: hard-coded pixel breakpoints
.app-component {
  padding: govuk-spacing(3);

  @media (min-width: 640px) {
    padding: govuk-spacing(5);
  }
}
```

GOV.UK Frontend provides these breakpoint aliases:
- `mobile` — up to 640px
- `tablet` — 641px and up
- `desktop` — 1021px and up

These align with GOV.UK's responsive design research and ensure consistency across the service.

