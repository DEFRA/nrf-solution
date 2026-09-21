# NRF2-1165 — Dedup / extraction candidates

Spike output: AI-assisted cross-repo comparison of `frontend/`, `backend/`, `admin-frontend/`
(plus mechanical baseline via jscpd, min-tokens 70, tests excluded). Deliverable is this ranked
candidate list to inform follow-up tickets — no code changes proposed here.

Rubric — a good candidate must satisfy ALL of: true duplication (bug-fix propagation test),
divergence-is-configuration-not-behaviour, high drift cost, low churn, one-sentence API,
≥2 real consumers today. Tiers: **T1** repo-local dedup · **T2** `@defra/nrf-library` extraction
(version + consumer PRs) · **T3** convention/lint only.

## Confirmed candidates (pre-sweep, mechanical + verified by diff)

| # | Candidate | Tier | Copies | Drift | Notes |
|---|---|---|---|---|---|
| 1 | `log-formatters.js` | T2 | backend `src/common/helpers/logging/`, frontend `src/server/common/helpers/logging/` | **verbatim, 0 diff lines** (66 lines) | Cleanest possible extraction |
| 2 | `logger-options.js` | T2 | backend `src/common/helpers/logging/`, frontend `src/server/common/helpers/logging/`, admin `src/server/plugins/` | near: backend↔frontend 20 diff lines; frontend↔admin 46 | 3-way copy; pino redaction/level config |
| 3 | `serve-static-files.js` | T2 | frontend `src/server/common/helpers/`, admin `src/server/plugins/` | import paths only (6 diff lines) | hapi static file handler |
| 4 | CSP (Blankie config) | T2 | frontend `src/server/common/helpers/content-security-policy.js`, admin `src/server/plugins/content-security-policy.js` | same skeleton; values differ (conditional origins/nonces vs static + GOV.UK hash) | Needs configurable factory — would be the library's first plugin-style export |
| 5 | Session-cookie helper | T1 | frontend `src/server/quote/quote-details/helpers/quote-details-session-cookie.js`, frontend `src/server/request-to-use/session-cookie.js` | renamed identifiers only | Intra-repo; factory `createSessionCookieHelper({ name })` |
| 6 | `cdp-uploader.js` | T2? | admin `src/server/common/services/cdp-uploader/`, backend `src/services/cdp-uploader/` | **drifted fork** — 128 diff lines of ~140/159 | High effort: align first or accept divergence; ~77 lines still token-identical |
| 7 | Result-union typedefs | T3 | backend: `zip-safety.js`, `safe-filename.js`, `shapefile-contents.js` | same pattern re-declared 3× locally | Convention: one shared typedef per repo |
| 8 | `Toolkit` → `ResponseToolkit` | T3 | frontend `src/server/auth/redirect-to-sign-in.js` (old name) vs 5+ files using `ResponseToolkit` | naming only | One-line fix |

## Sweep findings

### Area 1 — Server bootstrap & plugins/middleware

**Verbatim / near-verbatim (import paths only):**

| Candidate | Tier | Copies | Drift |
|---|---|---|---|
| `logger.js` (11 lines) | T2 | backend `src/common/helpers/logging/`, frontend `src/server/common/helpers/logging/`, admin `src/server/common/helpers/logging/` | fe↔be **verbatim**; admin import path only |
| `pulse.js` — hapi-pulse graceful shutdown (14–15 lines) | T2 | all 3 repos (`common/helpers/`, `server/common/helpers/`, `server/plugins/`) | identical body |
| `request-tracing.js` (8–9 lines) | T2 | all 3 repos | import path + formatting only |
| `index.js` entrypoint — process error handlers + startServer (13 lines) | T2 | all 3 repos (`src/index.js`) | import paths/order, one log message |
| `security-headers.js` — onPreResponse COOP/COEP/etc (33 lines) | T2 | frontend `server/common/helpers/`, admin `server/plugins/` | **one value**: COEP `credentialless` vs `require-corp` — config only |
| `request-logger.js` | T2 | fe↔be identical; admin is behavioural superset (`pathToIgnore` for /public, /health, /favicon) | export style only (fe↔be) |
| `nunjucks.js` config (55 lines) | T2 | fe↔admin `src/config/nunjucks/` | 3 diff lines (trimBlocks/lstripBlocks, watch path) — config only |
| `requireInProduction` convict validator + convict skeleton | T2/T3 | inside all 3 config files (fe `src/config/config.js:29`, admin `src/config/config.js:23`, be `src/config.js:35`) | verbatim incl. JSDoc |
| `server.js` options block + plugin stack (~35 lines) | T3 (convention) | fe↔admin `server/server.js` | verbatim options block; same plugin registration order |
| health + version endpoints (incl. OpenAPI JSDoc blocks) | T3 | all 3 repos | structural + verbatim doc blocks |
| `metrics.js` — AWS embedded-metrics counter | T2 | fe↔be | config path + export style |

**Renamed / structural duplicates:**

| Candidate | Tier | Copies | Notes |
|---|---|---|---|
| Service-to-service auth plugin | T2 | backend `src/plugins/auth.js` (52), admin `server/common/helpers/auth/bearer-auth.js` (37) | constant-time compare helper near-verbatim (`constantTimeEquals` vs `safeEqual`); shared-secret scheme |
| yar session plugin | T2 | admin `server/plugins/session-cache.js`, frontend `server/common/helpers/session-cache/session-cache.js` | mostly config; ⚠️ admin omits `maxCookieSize: 0` — behavioural (yar may fall back to client-side cookie storage) |
| Sign-out controllers | T3 | frontend `server/auth/controller.js`, admin `server/routes/auth/sign-out-controller.js` | same shape (clear session → discovery → end_session_endpoint → redirect); different IdPs/stores |
| Session-creation-on-callback | T3 | frontend `signInOidcController`/`createUserSession`, admin `auth-callback-controller.js` + `save-user-session.js` | structural; different providers/session shapes |

**Drifted forks (need align-then-extract decision):** `redis-client.js` (fe 95 ↔ admin 67 lines, ~55-line shared core), `errors.js`/catchAll (fe adds error templates; admin passes through API messages), `start-server.js` (3 copies, shared ~15-line core + repo-specific health checks), `cache-engine.js` (admin has memory fallback; fe redis-only), `nrf-backend.js` Wreck client (fe 102 ↔ admin 48, fe superset), `cdp-uploader.js` (already known).

**Rejected as duplicates (intentionally different):** the auth stacks overall — frontend hand-rolls Defra ID B2C OIDC (288-line controller + refresh tokens); admin delegates to `@defra/hapi-auth-oidc` with Entra/Cognito. Token refresh, router boilerplate trio, fail-action patterns: concept-similar only. `plugins/cookies.js` (fe) vs `plugins/session-cookie.js` (admin): similar names, unrelated purposes.

**⚠️ Security drift found by the sweep (not dedup — align):** admin's sign-in captures the HTTP Referer as post-login redirect with **no open-redirect guard** (escapeHtml on output only); frontend validates via `get-safe-redirect.js` (relative-only, rejects `//`, `%2f%2f`). This is exactly the drift cost the rubric warns about — worth its own small ticket.

**Consolidation verdict (area 1):** the verbatim cluster — logger.js, log-formatters.js, logger-options.js, request-logger.js, request-tracing.js, pulse.js, index.js, security-headers.js, serve-static-files.js — is one coherent **"server bootstrap kit"** extraction into `@defra/nrf-library` (single version bump + 3 consumer PRs), rather than nine piecemeal tickets. Bigger forks (redis-client, cdp-uploader, nrf-backend client, errors) each need an align-first decision.

### Area 4 — View layer (frontend ↔ admin-frontend)

Both repos were seeded from the same boilerplate, which explains the shared skeleton. Note:
`@defra/nrf-library` is currently **server-only** — any view-layer extraction adds a new
export surface to the library.

| Candidate | Tier | Copies | Drift |
|---|---|---|---|
| `nunjucks.js` config (55 lines) | T2 | fe↔admin `src/config/nunjucks/` | 52/55 lines identical; 3 config-only diffs (trimBlocks/lstripBlocks, vision path) — factory `createNunjucksConfig({ trimBlocks, viewRoot })` collapses each to ~5 lines |
| `heading` GOV.UK component | T2 | fe↔admin `src/server/common/components/heading/` | all 4 files **verbatim** (scss, macro.njk, template.njk; test differs by one import) |
| `format-currency.js` filter (+ its test) | T2 | fe↔admin `…/filters/` | verbatim, incl. test file |
| `format-date.js` filter | T2 | fe↔admin | `formatDate()` verbatim; admin adds `formatDateTime` (contribution, not drift) |
| `component-helpers.js` `renderComponent` (48/46 lines) | T2 | fe `src/server/common/test-helpers/` ↔ admin `test-helpers/` | body verbatim; diffs are import style + template root — parameterise two path roots. Also fold in fe-internal 3rd variant `src/test-utils/render-nunjucks-component.js` (JSDOM flavour) |
| Client bootstrap `application.js` | T2 | fe↔admin | govuk-frontend `createAll` block verbatim; extract `initGovukFrontend()` + app hook |
| `about/index.njk`, shared SCSS partials (`_links.scss`, `_colours.scss`, `_index.scss`) | T2 | fe↔admin | verbatim / one caption line |
| Test utils: `axe-helper.js`, `setup-msw-server.js` (verbatim), `load-page.js` (near) | T2 (needs library test entry point) | fe↔admin `src/test-utils/` | verbatim / small |
| `page.njk` base layout | T2 (later) | fe (113 lines) ↔ admin (85) | ~60% structural overlap; divergence is genuine features (CSP nonce, GTM, phase banner vs govuk v6 service-nav, vite assets) — block-based base layout once smaller items land |
| `context.js` / `getAssetPath` | T2 (weakest) | fe (106) ↔ admin (41) | manifest format split: webpack flat map + dev mtime reload vs vite keyed `{file}` prod-only — needs a manifest adapter or standardising on one shape |

**Rejected (view layer):** `build-navigation.js` (same signature, entirely different content); `error/index.njk` (shape only); `select-all.js` vs `disable-submit-button.js` (shared idiom, different behaviour); `webpack.config.js` vs `vite.config.js` (different bundlers); `setup-test-server.js` (fe's Redis gate/singleton is behaviour admin lacks); map JS / GTM / cookie-banner (frontend-only, zero duplication).

### Area 3 — Validation schemas, constants, enums

**v1.11.0 library migration status: fully landed in all three repos** (backend #318 → 6b61559, frontend #461 → 3b7d475, admin #116 → 8ad1a158 merged; no orphans). One lingering local copy:

- **admin `src/server/common/validation/reference-pattern.js`** (4 lines, `/^NRL-\d{6}$/`) — should import the library's `referencePattern`/`referenceParam` (wrinkle: library pattern is unanchored). Trivial T1 cleanup.

| Candidate | Tier | Copies | Drift |
|---|---|---|---|
| `statusCodes` constants | T2 | all 3 repos `common/constants/status-codes.js` | values-only but **key names differ** (`found` vs `redirect` for 302; repo-specific additions 201/413/429/502/503) — needs key alignment |
| `formatCurrency` (8 lines) | T2 | fe↔admin nunjucks filters **byte-identical**; backend `src/common/helpers/format-currency.js` same body as arrow fn | verbatim; obvious sibling to library's `formatCurrencyPrecise` |
| `formatDate` filter | T2 | fe↔admin | fe is strict subset; admin adds `formatDateTime` |
| Email Joi fragment | T2 | fe `src/server/common/validation/email.js` (39 lines, canonical w/ GOV.UK messages) + backend `api/quote/validation/post-schema.js` and `api/users/validation/patch-schema.js` (two verbatim inline copies of each other, no messages) | library ships core rule chain (`trim().max(254)…email({tlds:{allow:false}})`), per-repo messages at call site |
| Quote wire-contract enums (`planningType` values, `boundaryEntryType`, `MAX_BOUNDARY_FILENAME_LENGTH=255`) | T2 | backend `api/quote/validation/post-schema.js` ↔ fe `quote/helpers/quote-schema/` + `planning-type/options.js` + `boundary-type/form-validation.js` | same enums maintained in both; **⚠️ real divergence: `housingUnits` max 50,000 (fe) vs 999,999 (be)** — fe stricter so no hole today, but the pair must move together |
| Upload `redirect` Joi rule (`uri({relativeOnly:true})`) | T3 | backend `src/routes/upload.js:43` ↔ admin `routes/api/uploads/schemas.js` | verbatim rule inside different supersets; admin's `uploadId` pattern is a **lookalike that fails** (not UUIDs) |
| Convict base config | T2 (later) | fe (491 lines) ↔ admin (450) ↔ be (386) | shared scaffold + `requireInProduction` + ~46 identical lines; divergence is genuine features — library "base config" helper with per-repo extension |
| `nrf-backend.js` client | T2 | fe (102) ↔ admin (48) | ~77% structural overlap (withTraceId + x-api-key + Wreck get/delete); fe superset adds POST |

**Rejected (validation/constants):** `audit-events.js` (same filename/shape, different event domains); duplicated error-response Joi schemas hypothesis **fails** (no response-side Joi in backend; errors live in OpenAPI JSDoc only); `geometrySchema` (single consumer); admin's `listFilesQuerySchema` token (S3 pagination, unrelated to library `tokenParam`); magic number 255 variants (fold into quote fragments if extracted). Impact-assessor (Python) mirrors `BOUNDARY_ERRORS` by hand — cannot consume npm, library comment already mandates sync.

### Area 2 — Common helpers, service clients, test utils

| Candidate | Tier | Copies | Drift |
|---|---|---|---|
| **"trace + service key" header builder** | T2 | **6 copies**: fe+admin `nrf-backend.js backendHeaders`, backend `impact-assessor.js impactAssessorHeaders`, admin `impact-assessor.js dataSyncHeaders`, admin `nrf-frontend.js frontendHeaders`, inline in fe `ia-map-tile-server.js` | all are `withTraceId(...) + if (secret) headers['x-…'] = secret` (~10 lines × 6) |
| `getGitHash()` | T2 | fe `server/common/helpers/git-hash.js` ↔ embedded in backend `src/routes/version.js` | verbatim |
| Wreck catch-block error-context idiom | T2 | 9 occurrences across fe uploader.js/boundary.js, backend + admin cdp-uploader.js | same `statusCode/responsePayload` template — tiny shared `wreckErrorContext(error)` |
| Service base-URL env fallback (`config URL → https://<svc>.${ENV}.cdp-int… → localhost`) | T1 (backend-internal) | backend `cdp-uploader.js` + `impact-assessor.js` | service name differs only |
| `nrf-backend.js` client | T2 | fe (102) ↔ admin (48) | cross-confirmed (area 3): ~77% overlap; extractable core = `backendHeaders` + `getRequestFromBackend` |
| impact-assessor clients | T2 | backend (checkBoundary*) ↔ admin (dataSync*) | same wrapper skeleton, different API surfaces — extract wrapper, not endpoints |
| `getS3Client()` lazy singleton (~15 lines) | T2 | backend `services/s3/s3-client.js` ↔ admin `services/s3/s3.js` | config-key naming only |
| `setup-proxy.js` | T2 (**needs decision**) | backend ≈ admin (global-agent, verbatim); frontend **diverged to undici ProxyAgent** | mechanism split — behaviour decision before dedupe |
| fe `uploader.js` (103 lines) | T3 | fe ↔ (backend/admin cdp-uploader contracts) | deliberate proxy facade over NRF backend — not a fork; contract/types could be shared |
| Test utils: `setup-msw-server.js` (3 copies; fe↔admin byte-identical), `axe-helper.js` (byte-identical) | T2 (test entry point) | all 3 repos `src/test-utils/` | verbatim; backend's msw adds localhost passthrough |
| Inline test mocks | T1 (frontend-internal) | 6 fe test files inline `const h = {…}` toolkits + 4 inline loggers | fe's centralised `create-mock-request.js`/`createMockResponseToolkit` imported by only 1 test — promote repo-wide |
| Result-union pattern | T3 | backend 3 local typedefs (all `code`-payloads from `BOUNDARY_ERRORS`); fe/admin use a weaker ad-hoc `{ error: '<string>' }` convention in service clients | one shared `Result` typedef in library (parameterised on success payload); fe/admin joining needs a codes-based migration |

**Redis/session quantification** (cross-confirms area 1): `redis-client.js` — the ~55-line `buildRedisClient()` core is line-for-line identical fe↔admin; drift is port sourcing (config vs hardcoded 6379) + fe-only `waitForRedisClientReady()`. `cache-engine.js` — same CatboxRedis core; admin adds memory fallback, fe returns client.

**Rejected (helpers/clients):** `govuk-date.js` (different formatter); OS proxy routes (frontend-only); backend token/postgres/notify helpers (single-repo); fe tile-cache vs admin clearFrontendTileCache (producer/consumer pair); retry logic — **no bespoke reimplementations exist**; backend send-email wrappers already correctly delegate to the library's `retryAsyncOperation` (the pattern done right).

## Consolidated ranking (drift cost × consumers ÷ extraction cost, security first)

### Recommended follow-up tickets

1. **Library "server kit" — logging/observability + verbatim misc** (T2, cheapest × 3 repos): `logger.js`, `log-formatters.js` (verbatim), `request-logger.js`, `request-tracing.js`, `pulse.js`, `metrics.js`, `git-hash`, `statusCodes` (align keys `found`/`redirect` first), `formatCurrency`/`formatDate` (join `formatCurrencyPrecise`). One version bump, 3 consumer PRs, near-zero design work.
2. **Library "security kit"** (T2, highest drift cost): `security-headers.js` (COEP value per app) + CSP Blankie factory + `serve-static-files.js`. **This is the ticket's pre-seeded item #1** — and it introduces the library's first configurable-plugin/factory pattern (see premise correction below).
3. **Frontend session-cookie factory** (T1, trivial): `createSessionCookieHelper({ name })` collapsing the near-verbatim pair. The ticket's pre-seeded item #2.
4. **Admin `reference-pattern.js` → library import** (T1, trivial): last lingering v1.11.0 local copy.
5. **Library "service-client kit"** (T2): the 6-copy header builder, `nrf-backend.js` core, `wreckErrorContext`, base-URL fallback, `getS3Client` singleton, impact-assessor wrapper.
6. **Quote wire-contract enums to library** (T2, needs product decision): planningType/boundaryEntryType lists + `MAX_BOUNDARY_FILENAME_LENGTH`; **reconcile `housingUnits` 50,000 (fe) vs 999,999 (be) deliberately**.
7. **Library "view kit"** (T2, new export surface): nunjucks config factory, `heading` component, filters, `renderComponent` helper, `initGovukFrontend()`, shared SCSS partials, test-utils entry (axe-helper, setup-msw-server).
8. **Align-then-decide forks** (one ticket per fork, or a decision ticket): `cdp-uploader.js` (admin↔backend, 128-line drift), `redis-client.js`/`cache-engine.js`, `errors.js` catchAll (share message-map core, per-app templates), `setup-proxy.js` (global-agent vs undici), `logger-options.js` (admin missing ECS error structuring), convict base-config + `page.njk` base layout + `context.js` manifest adapter (longer-term).
9. **Security alignment (not dedup — separate small tickets)**: admin sign-in open-redirect guard (fe's `get-safe-redirect.js` is the model); admin yar `maxCookieSize: 0` omission.
10. **Conventions tidy** (T3): `Toolkit` → `ResponseToolkit` (one fe file); backend shared `Result` typedef (3 re-declarations); backend email-Joi fragment (2 verbatim inline copies + fe canonical); `requireInProduction` already counts toward ticket item #3's spirit.

### Not extraction (documented to prevent re-litigation)

Auth stacks (Defra ID hand-rolled vs `@defra/hapi-auth-oidc` — intentionally different); `build-navigation.js`; `webpack.config.js` vs `vite.config.js`; `audit-events.js` (different domains); backend error-response Joi (doesn't exist — OpenAPI JSDoc only); impact-assessor Python `BOUNDARY_ERRORS` mirror (hand-sync mandated); VTS map-style JSONs (vendor data).

## Premise correction for follow-up tickets

The ticket says a CSP extraction should be "configurable plugins (mirrors the v1.11.0
validators extraction)" — but v1.11.0 shipped the validators as **plain named exports**
consumed by direct ESM import (`referenceParam`, `quotePatchSchema`, …), with no
register/configure machinery. A configurable plugin/factory would be a **new pattern** for
`@defra/nrf-library`, so that follow-up ticket needs to design the registration/config shape
rather than copy an existing one.
