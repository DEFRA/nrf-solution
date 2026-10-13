# Journey page conventions

How each file of a journey page in `nrf-frontend` is written. Applies to every area under `frontend/src/server/` (`quote`, `manage`, `request-to-use`, ...) when creating or modifying a page.

## Files

Each page lives in its own folder, `frontend/src/server/<area>/<route ID>/`:

| File                    | Purpose                                                               | Pages that have it |
| ----------------------- | --------------------------------------------------------------------- | ------------------ |
| `route-path.js`         | The page's route path; import-free leaf module                        | all                |
| `routes.js`             | Route definitions; re-exports `routePath`                             | all                |
| `get-view-model.js`     | Builds the template data object                                       | all                |
| `index.njk`             | The view                                                              | all                |
| `form-validation.js`    | Returns a Joi schema for the POST payload                             | form pages         |
| `get-next-page.js`      | Returns the redirect path after a successful POST                     | form pages         |
| `controller-post.js`    | Only when the standard POST controller can't be used (see Controllers) | rare               |
| `page.test.js`          | Page tests                                                            | all                |
| `accessibility.test.js` | Accessibility test                                                    | all                |
| `form-validation.test.js` | Schema unit tests                                                   | form pages         |

Pages without a form (content, dropout and confirmation pages) omit the form files and have a GET route only.

Examples to copy from: `quote/not-housing` (dropout), `quote/delete-quote-confirmation` (confirmation), `manage/start-page` (content), `quote/boundary-type` (form).

## `route-path.js` and `routes.js`

`route-path.js` must stay import-free. Other pages' `get-next-page.js` / `get-view-model.js` and shared controllers import it, and anything it imports risks a circular import (the page's `routes.js` imports back into those controllers), which surfaces as an ESM TDZ crash. Cross-page path imports must always come from the target page's `route-path.js`, never its `routes.js` (see the Route paths rule in `javascript.md`).

```js
const routeId = '<route ID>'

// Leaf module: must stay import-free — shared controllers and other pages
// import this path to avoid circular imports through routes.js.
export const routePath = `/<area>/${routeId}`
```

`routes.js` is the wiring point: it imports the area's controllers, the page's logic files and `routePath`, re-exports `routePath` as a named export (so importers keep working) and default-exports the route array:

```js
import { quoteController } from '../controller-get.js'
import { quotePostController } from '../controller-post.js'
import getViewModel from './get-view-model.js'
import formValidation from './form-validation.js'
import getNextPage from './get-next-page.js'
import { routePath } from './route-path.js'

const routeId = '<route ID>' // must match the page folder name

export { routePath }

/** @openapi ... */
export default [
  { method: 'GET', path: routePath, ...quoteController({ routeId, getViewModel }) },
  {
    method: 'POST',
    path: routePath,
    ...quotePostController({ routeId, formValidation, getViewModel, getNextPage })
  }
]
```

`routeId` must exactly match the folder name: the GET controller resolves the template as `<viewsDir>/<routeId>/index`. Add an `@openapi` JSDoc block above the array documenting each route (tag = the area name capitalised, e.g. `Quote`, `Manage`), as in `manage/start-page/routes.js` and `quote/boundary-type/routes.js`. Then import and spread the routes into the area's `index.js` (see `quote/index.js`, `manage/index.js`).

## `index.njk`

The template must:

- Extend `layouts/page.njk`
- Define `{% block pageTitle %}{{pageTitle}}{% endblock %}`
- For pages with a back link: define `{% block beforeContent %}` containing the `backLink` macro with `href: backLinkPath`. Confirmation pages have no back link and no `beforeContent` block.
- Use `govuk-grid-column-two-thirds-from-desktop` (not `govuk-grid-column-two-thirds`)
- Replace the `<h1>` contents with `{{pageHeading}}`. If the heading is the title of a `govuk-panel`, pass `titleText: pageHeading` to the macro instead.
- Define `{% block content %}` containing the page markup
- Use GOV.UK Design System Nunjucks macros for recognised components (see Component mapping). Check `layouts/page.njk` for already-imported macros before adding new imports there (not in the page file).
- Keep all other GOV.UK Frontend classes as-is (headings, body text, grid, lists, etc.)

### Forms

- Remove the form `action` so the form posts to the same URL; keep `novalidate`
- Include the CSRF token partial inside the form, as in `quote/boundary-type/index.njk`
- If a form group legend is also the page heading, use a `{% set legendHtml %}` statement to set it
- Field names are camelCase (e.g. `building-types` becomes `buildingTypes`), used in the template as `formSubmitData.<name>` and in the validation file
- Radio/checkbox values are lowercase and hyphenated from the label (e.g. 'Other residential' becomes 'other-residential'), unless the source gives explicit values
- For each radio or checkbox macro set `name` to the field name as a plain string (e.g. `name: "boundaryEntryType"`); for radios set `value: formSubmitData.boundaryEntryType`; for checkboxes set `values: formSubmitData.<name>` (the macro expects an array, not a scalar). This pre-selects the previously submitted value when the form is re-rendered after a validation error.
- Set each form group's `errorMessage` from `validationErrors.messagesByFormField.<name>`
- Do not set `id` on individual radio/checkbox items
- Prefix the `pageTitle` block value with `{% if validationErrors %}Error: {% endif %}`
- Add an error summary macro above the content, wrapped in `{% if validationErrors %}`, with `titleText: "There is a problem"` and `errorList: validationErrors.summary`

### Component mapping

Convert markup matching these patterns to the corresponding macro. For each, fetch the reference URL (without JavaScript) to get the exact import statement and macro call syntax. For form fields, pass `name` only; `id` defaults to the `name`.

| CSS class pattern     | Component     | Macro reference                                                                               |
| --------------------- | ------------- | --------------------------------------------------------------------------------------------- |
| `govuk-button`        | Button        | https://design-system.service.gov.uk/components/button/#button-example-nunjucks               |
| `govuk-error-message` | Error message | https://design-system.service.gov.uk/components/error-message/#error-message-example-nunjucks |
| `govuk-error-summary` | Error summary | https://design-system.service.gov.uk/components/error-summary/#error-summary-example-nunjucks |
| `govuk-radios`        | Radios        | https://design-system.service.gov.uk/components/radios/#radios-example-nunjucks               |
| `govuk-checkboxes`    | Checkboxes    | https://design-system.service.gov.uk/components/checkboxes/#checkboxes-example-nunjucks       |
| `govuk-panel`         | Panel         | https://design-system.service.gov.uk/components/panel/#panel-example-nunjucks                 |

## `get-view-model.js`

Returns a plain object consumed by the template. It receives the current form/session data and the parsed query as arguments. Always use a named function — never `export default function () {}`.

```js
import { getPageTitle } from '../../common/helpers/page-title.js'

export const title = '<Page heading text>'

export default function getViewModel(_data = {}, _query = {}) {
  return {
    pageTitle: getPageTitle(title),
    pageHeading: title,
    backLinkPath: '/<area>/<previous-page>' // omit for confirmation pages
  }
}
```

For `backLinkPath`, import the previous page's `routePath` from its `route-path.js`. Fall back to a literal path string only when that page isn't built yet or is a legacy page with no `route-path.js`.

## `form-validation.js`

A function returning a Joi schema (the schema factory, not the schema itself — the POST controller calls `formValidation()`). Handle each input type as follows:

- **Radios / selects**: `joi.string().valid(...allowedValues).required()`. Nothing selected means the field is absent from the payload. Handle both `'any.required'` and `'any.only'` (unrecognised value) with the same message.
- **Checkboxes**: `joi.array().items(joi.string().valid(...allowedValues)).single().required()`. `.single()` is required because one checked box submits a plain string rather than an array. Handle `'any.required'` and `'any.only'` with the same message; do not add `'array.min'` (unreachable via a normal HTML form).
- **Text inputs (required)**: an empty string is submitted when blank, so handle both `'string.empty'` and `'any.required'`.
- **Text inputs (optional)**: `joi.string().allow('')`. Always include optional fields, or Hapi rejects submissions that include them as unknown fields.
- **Email** (type="email"): text input rules plus `.email({ tlds: { allow: false } })`, handling `'string.email'` with the GOV.UK message `'Enter an email address in the correct format, like name@example.com'`.
- **Number** (type="number"): `joi.number().integer().required()` (Hapi converts strings to numbers by default). Handle `'any.required'`, `'number.base'` and `'number.integer'`. Do not use `joi.string()`.

Where the same message string appears more than once in a field's `.messages({})`, extract it to a named `const` at the top of the file. See `quote/boundary-type/form-validation.js`.

## `form-validation.test.js`

See `quote/boundary-type/form-validation.test.js`. For each field: passes for each valid value (one test per allowed value for radios/checkboxes); fails with the correct message when absent; for radios/checkboxes, fails with the correct message for an unrecognised value. If the form has optional text fields, add an `optional fields` describe block (passes when all are absent, when all are empty strings, and when all have values). Extract a `validRequiredData` const for reuse.

## `get-next-page.js`

A named default export taking the form data and returning the next page's path. Import each next page's `routePath` from its `route-path.js`; never hard-code a path for a page that exists. Use a literal string only for a page that isn't built yet. For conditional routing, branch on the submitted value.

## Updating neighbouring pages (new page inserted into an existing flow)

When the new page's previous page or next pages already exist, update them so existing links don't skip it:

- **Previous page(s):** change the target of the redirect after a successful submit (`get-next-page.js`, or a POST handler) to the new page, and update its tests. Change only the redirect target; leave any other handling in that handler as it is. If the previous page has no `route-path.js`, add one (import-free, re-exported from `routes.js` so existing importers keep working) before importing it.
- **Existing next page(s):** change their `backLinkPath` to the new page's `routePath`, and update their tests.
- Any other existing page whose back link or redirect targets the journey step the new page now precedes.

## Controllers

**GET:** each area exports a GET controller built with `createPageController({ viewsDir })` from `common/controllers/page-controller.js` (`quoteController`, `manageController`). It reads any validation flash from the session and clears it, builds `formSubmitData` from the area's session data, calls `getViewModel(data, request.query)`, and renders `<viewsDir>/<routeId>/index` with `validationErrors` and `formSubmitData` merged in. This is what re-displays errors after the PRG redirect.

**POST (`quote` area):** use `quotePostController` from `quote/controller-post.js`. It runs `formValidation()` as the Joi payload schema; on failure maps the errors, saves a flash to the session and redirects back (303, `.takeover()`); on success saves the payload into the quote session, calls `getNextPage(quoteData)` and redirects forward (303).

**POST (other areas):** `quotePostController` saves into the quote session, whose schemas are closed objects, so it must not be used for other areas' fields. Use the first of these that exists: a shared POST controller factory in `common/controllers/`; the area's own `controller-post.js`; otherwise a minimal page-local `controller-post.js` that validates with `formValidation()`, uses `redirectToFormWithValidationErrors` from `quote/controller-post.js` as the `failAction`, and redirects to `getNextPage(payload)` with `statusCodes.redirectAfterPost`.

Write a custom POST controller in the `quote` area only when the handler must do more than validate, save and redirect (calling a backend API, clearing dependent keys, resolving a display name). Always follow PRG: on validation failure save the flash and redirect back with `statusCodes.redirectAfterPost` and `.takeover()`; on success redirect forward with `statusCodes.redirectAfterPost`.

## Quote area session helpers

For pages in the `quote` area, use the helpers in `quote/helpers/quote-session-cache/` (`saveQuoteDataToCache`, `getQuoteDataFromCache`, `getCompleteQuoteDataFromCache`, `clearQuoteDataFromCache`). Session keys are camelCase. Never read `request.yar` directly in a page controller.

## `page.test.js`

See `quote/not-housing/page.test.js` (no form) and `quote/boundary-type/page.test.js` (form). Every page test asserts the `h1` matches `pageHeading`, `document.title` matches `pageTitle`, and the Back link `href` matches `backLinkPath` (or, for a confirmation page, that there is no Back link). Content links: assert the link has the expected `href`.

Form pages also need:

1. A test that primes the validation flash and loads the page, asserting the message is shown. Use `expectFieldsetError` (radios/checkboxes: `document`, `errorMessage`) or `expectInputError` (text/number: `document`, `inputLabel`, `errorMessage`) from `frontend/src/test-utils/assertions.js`.
2. For fields with format validation (e.g. email), a second error test priming the format error plus the invalid value.
3. A test per happy-path outcome that submits valid data and asserts a redirect with the expected `location` header.
4. A test that submits invalid data and asserts a redirect back to the same URL with the validation errors saved to the flash.
5. A test that the form contains the hidden CSRF token input.
6. `quote` area only: tests that a previous valid selection is pre-populated.

## `accessibility.test.js`

See `manage/start-page/accessibility.test.js` (no form) and `quote/boundary-type/accessibility.test.js` (form). For a form page, submit the form with invalid data first so the rendered error summary and inline errors are included in the check.
