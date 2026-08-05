# Styling guidelines

## Use GOV.UK utility classes over custom CSS

Prefer GOV.UK Design System classes to custom CSS rules for typography, spacing, and colour, even in bespoke components that don't otherwise use standard GOV.UK page layout.

- Headings must use a `govuk-heading-*` class (e.g. `govuk-heading-s` for 19px) rather than a custom class with a hand-rolled `font-size`/`font-weight`.
- Body text must use a `govuk-body-*` class (e.g. `govuk-body-s` for 16px) rather than a custom class with a hand-rolled `font-size`.
- Always use the GOV.UK SASS spacing helpers (`govuk-spacing($n)`, or the `govuk-!-margin-*`/`govuk-!-padding-*` override classes — see https://design-system.service.gov.uk/styles/spacing/) instead of hard-coded pixel values for margin and padding.
- Always use GOV.UK colours (`govuk-colour("...")`, or the design tokens/CSS custom properties GOV.UK Frontend exposes) instead of hard-coded hex values, so colours stay in sync with the design system's palette.

This keeps bespoke UI (e.g. panels rendered inside third-party components like the interactive map) visually consistent with the rest of the service, and means future GOV.UK Frontend upgrades update these components automatically.
