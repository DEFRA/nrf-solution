# Javascript coding guidelines

## Functions

- Use short, single-purpose functions. Any over 75 lines will be failed by SonarQube, but aim to make them shorter. When a handler or function grows beyond ~20 lines, look for a named helper to extract — especially for logic that can be tested independently (rate limiting, cache reads, transformations). Keep controllers thin: they should orchestrate calls to helpers, not contain the logic themselves.
- If there are multiple function params, use an object param instead
- For functions that accept params that include structured objects, add JSDoc annotations for the entire signature (all params, not just the structured ones) — this applies to all functions, including module-private helpers, not just exported ones. Functions where every param is a primitive don't need JSDoc as the types can be inferred.
- All functions should be named, not anonymous, to improve readability in stack traces
- Prefer named exports (`export const`, `export function`) over default exports. Default exports are acceptable for page-level single-purpose files where the file name already conveys the identity (e.g. `get-view-model.js`, `form-validation.js`) — but always name the function even then: `export default function getViewModel() { ... }` not `export default function () { ... }`

## Comments

- Don't add comments that explain what the change does or restate what the code already makes clear (e.g. "returns a machine-readable code, not display text" above a function that obviously returns a code). Only comment non-obvious *why* — a constraint, a workaround, an ordering requirement.
- Don't reference file paths in comments (e.g. "see frontend/src/server/common/constants/foo.js") — paths move and rot, and the comment goes stale silently. Refer to the module/concept by name instead, or let imports do the pointing.

## Functional / classes

- Favour functional approach over instantiable classes

## Native methods

- Prefer built-in native methods over manual or library reimplementations when one exists. For example use `Object.hasOwn(obj, key)` over `Object.prototype.hasOwnProperty.call(...)`, `structuredClone(x)` over `JSON.parse(JSON.stringify(x))`, and `array.at(-1)` over `array[array.length - 1]`. Native methods are clearer, faster, and less error-prone.
- Never name an import, variable, or function the same as a native built-in, as it shadows the native one and is flagged by SonarQube rule S2424 ("Remove this override of ..."). Common offenders: `escape`/`unescape`, `name`, `event`, `top`, `status`, `length`, `closed`. Alias library imports to a clearer name instead — e.g. `import escapeHtml from 'lodash/escape.js'` rather than `import escape from 'lodash/escape.js'`.

## Server-side code

### Config

- If an env var varies between environments, read it via config rather than hard-coding it
- Set non-secret env vars in `compose.yml` (committed)
- Set secret env vars in the nrf-solution `compose.override.yml` (git-ignored) locally, and in the CDP portal for deployed services — never commit them
- When you add a new `env:` key to `config.js`, note in the PR that it needs wiring into `compose.yml` (non-secret) or `compose.override.yml` (secret), plus any deployment config. For a secret, also add the var name — but not its value — to `compose.override.template.yml`, which is committed as a record of the secrets needed to run the apps locally
- Read config inside functions, not at module scope — module-level reads are cached on first import, so the value is frozen for the lifetime of the process. This makes it impossible to test different config values without `vi.resetModules()` and dynamic imports, which adds significant test complexity

### Observability

#### Tracing

- For any inter-service call or message, include the tracing header (example in `src/server/common/services/nrf-backend.js`)

#### Logging

- call `logger.error(error, message)` — always pass the error instance as the first param, message string second. Never call `logger.error(error)` with one argument (the message is lost) or `logger.error('string', {...})` with a string first (the error object is dropped from structured logs)
- call `logger.info({ ...context }, message)` — always pass a context object as the first param, never a plain string; include relevant identifiers (eg IDs, template names) in the context object
- prefer using createLogger in modules rather than passing the request.logger in as a function parameter

### Services pattern

The `src/services/` (backend) and `src/server/common/services/` (frontend) folders are for code that interacts with **external systems** — databases, HTTP APIs, message brokers (SNS/SQS), email providers (Notify), etc. Pure utility functions (crypto helpers, formatters, validators) belong in `src/common/helpers/` instead.

- Where you need to interact with other services eg APIs, wrap the code in a service (see examples in `src/common/services`
- If a service interaction is not blocking the user experience, consider adding a retry mechanism
- Base paths for other services should come from config as a separate env var (eg avoid getImpactAssessorUrl)

#### Backend-to-backend HTTP calls

All backend HTTP calls **must** go through a service module — never call `@hapi/wreck` (or any HTTP client) directly from a controller or route handler.

- Create a service module under `src/server/common/services/` (e.g. `src/server/common/services/nrf-backend.js`)
- The service must wrap `@hapi/wreck` and must inject the tracing header on every outbound request (see the Tracing section above)
- The canonical example to follow is `nrf-frontend/src/server/common/services/nrf-backend.js` — replicate this pattern for any new service in any frontend app, including `admin-frontend`
- The base URL for the target service must come from config (a dedicated env var), not be hard-coded or constructed dynamically in the caller

### Security

- Don't expose any secrets or API keys; they should come from env vars which are exposed to the app via the config.js file
- validate / sanitize user inputs
- Every POST route that accepts a request body must have a `options.validate.payload` Joi schema — especially unauthenticated ones. Without it, raw user-supplied values can be used for dynamic dispatch or passed directly to loggers/services
- Nunjucks `autoescape: true` HTML-encodes output but does NOT prevent JS injection inside `<script>` blocks — any `{{ variable }}` rendered inside a JS string literal must either be validated against a strict allowlist (e.g. `/^GTM-[A-Z0-9]+$/`) or use the `| dump` filter to JSON-encode it safely
- Never put PII or sensitive identifiers (Defra ID `sub` claims, emails, names) in URL paths or query strings — they are recorded in access logs, proxy logs, and browser history. Pass them in the request body or headers instead. If a value must appear in a URL, document and justify that decision in the route's OpenAPI description. When reviewing, check consistency: if one endpoint keeps a value out of the URL, a sibling endpoint exposing the same value in the path is a finding

#### SQL injection (`pg`)

- Pass **values** as parameters, never interpolate them into the SQL string. Use placeholders (`$1`, `$2`, …) with the values array as the second arg to `db.query`: `db.query('... WHERE reference = $1', [reference])`. Never build queries with template literals or `+` containing a value (`` `... WHERE reference = '${reference}'` ``).
- SQL identifiers (table/column names) can't be parameterized. Avoid interpolating them at all; if a query genuinely needs a dynamic identifier, the value must come from a hard-coded allowlist (a constant map/array in the code), never from request input.
- Interpolating a **static constant** SQL fragment (e.g. `` `${QUOTE_SELECT_SQL} WHERE q.reference = $1` `` where `QUOTE_SELECT_SQL` is a module constant) is fine — the rule is about dynamic/request-derived data, not constants.
- When reviewing: flag any template literal or string concatenation inside a `.query(...)` call that contains anything other than a static constant. The values must be in the params array.

### Validation

- if validating any object or response payload, use Joi rather than custom validation
- favour tighter validation over loose validation eg if accepting a string field in a payload, apply a max length if possible and sanitize
- always prefer re-using an existing Joi fragment over writing a new inline schema. Before adding a field schema (email, reference, token, etc.) to a controller or route, check `src/server/common/validation/` (and nearby `form-validation.js` files) for one that already covers it. If a suitable fragment exists, import and reuse it; if two or more places need the same field validation, extract a shared fragment into `src/server/common/validation/` rather than duplicating the rules and messages inline. Duplicated field validation is a frequent source of frontend/backend divergence (e.g. one place accepting an address the other rejects)

### HTTP status codes

- Always use `statusCodes.<name>` rather than literal numbers — this applies to all HTTP status codes, including 4xx and 5xx (e.g. `statusCodes.tooManyRequests` not `429`, `statusCodes.notFound` not `404`)
- This applies in test files too: assert `expect(response.statusCode).toBe(statusCodes.redirectAfterPost)` not `.toBe(303)`, and pass constants (not literals) when stubbing response statuses in MSW handlers or fixtures
- If a needed code is missing from the constants object (e.g. `found: 302`), add it there rather than falling back to a literal
- Import `statusCodes` from `@defra/cdp-validation-kit` if it is available as a dependency: `import { statusCodes } from '@defra/cdp-validation-kit'`. If not available, use the local `src/server/common/constants/status-codes.js` copy. Do not duplicate status code values inline.

## Hapi route & controller conventions

### Frontend POST–Redirect–GET (PRG) pattern

Frontend form POST handlers must follow PRG:

- On validation failure: save errors and submitted values to the session flash, then `h.redirect(request.path).code(statusCodes.redirectAfterPost).takeover()` — never re-render the view directly from a `failAction`
- On success: save data to session then `h.redirect(nextPage).code(statusCodes.redirectAfterPost)`
- Use `statusCodes.redirectAfterPost` (303), not a literal number
- **Every** redirect returned from a POST handler needs `.code(statusCodes.redirectAfterPost)` — including early-return guards and fallback branches (e.g. missing-session redirects), not just the main success path. A bare `h.redirect()` from a POST defaults to 302

This ensures browser back/refresh doesn't re-submit the form.

### Route paths

- Never hard-code a page path (e.g. `'/quote/email'`) in a controller. Each page's `routes.js` exports `routePath` — import it (`import { routePath as emailPath } from '../email/routes.js'`) and redirect to that
- View models expose these imported paths to templates — see the Links rule in [html.md](./html.md) for the template side

### Handler method style

Use method shorthand syntax inside controller objects:

```js
export const myController = {
  async handler(request, h) { ... }
}
```

Do not use arrow function syntax for `handler` (`handler: async (request, h) => { ... }`) — method shorthand is consistent with how Hapi documents its API and matches the pattern used across the codebase.

### Responses

Always return `h.response(payload)` rather than returning a raw object — Hapi will not set status codes or headers on a raw return value. Return `Boom.*()` errors directly (they do not need to be wrapped in `h.response()`).

## Quote helpers (`src/server/quote/helpers/`)

Each helper lives in its own subfolder as `<name>/index.js` alongside `<name>/index.test.js` — consistent with `quote-session-cache/`, `quote-schema/`, etc. Do not place helper files directly in `helpers/`.

## Session (Yar)

- Access the session via `request.yar` inside route handlers
- Use `request.yar.set(key, value)`, `request.yar.get(key)`, and `request.yar.clear(key)` — do not access the underlying storage directly
- Session keys must be camelCase strings (e.g. `'quoteData'`, `'pendingUploadId'`) — never snake_case
- Session data should be validated with Joi when read back, not assumed to be the shape that was written
- Use optional chaining when accessing nested properties from session or cache data (e.g. `quoteData.boundaryGeojson?.intersectingExcludedAreas`). A user can reach any page via direct navigation, a shared link, or an expired session — an unguarded nested access throws a TypeError and returns a 500

## Client-side Javascript (run in the browser)

Server-side code should be used where possible; client-side code should be kept to an absolute minimum, to meet the requirement for progressive enhancement.

### Use CSS for style

If possible, avoid applying style attributes directly to an element using javascript; instead add a CSS class and store the style properties in a CSS file.

### Error handling

- Never silently swallow a caught error (e.g. an empty `catch {}` block or `.catch(() => null)`) — always call `logger.error(error, message)` (the browser logger, imported from the client-side `logger` module) so failures are visible instead of disappearing. This applies even when the UI has a sensible fallback for the failure — the fallback and the log are not mutually exclusive.
