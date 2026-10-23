# Tests

## Types of test

- **Unit** - the lowest level, prefer this for edge cases, there should be many more of these than acceptance tests as they're faster and easier to debug.
- **Acceptance** - Acceptance tests should use the inputs and outputs that a user would generate and expect eg send a real request and parse the returned page DOM. See any page.test.js in nrf-frontend for an example. Or for a backend API, send a request and assert on the response.
- There are also **journey** tests but those are in a different repo (nrf-journey-tests) and should be reserved for very few 'happy path' cases, or functionality that's too complext to test using unit or acceptance tests.
  - Journey tests should not cover form validation errors - these are covered by the page's `page.test.js` in nrf-frontend.

## Location

- Unit tests for a given code file should be in the same directory as the file. For acceptance tests put the test file in the same folder as the page or the endpoint controller it's testing.

## Mocking

- minimise mocking: only mock at the boundary of the system under test (eg external HTTP calls, browser APIs). Do not mock internal helpers or session utilities in controller tests — let them run real and push mocking to the actual external boundary (HTTP via MSW, AWS SDKs, etc). When a controller test would require mocking an internal helper, that's a signal the test should be an acceptance test using a real server instead. Do not mock internal library functions like `retryAsyncOperation` — use fake timers (`vi.useFakeTimers()`) instead to test time-dependent behaviour without real delays
- for mocking responses from service calls out to other APIs, prefer Mock Service Worker rather than mocking fetch or HTTP clients like Wreck ([example](../../frontend/src/server/quote/check-your-answers/controller-post.test.js)). This applies to any test whose code path makes a backend call — not just form POSTs. If you're reaching for `vi.mock('.../services/...')`, stub the HTTP endpoint with MSW instead.
- don't copy the mocking style of an existing neighbouring test if it predates these rules (e.g. mocks service modules or hand-rolls session setup) — follow the rules, not the legacy pattern
- no need to reset or clear mocks within test files as `mockReset` is set globally for vitest
- the test suite spins up a real redis container so tests **don't** have to mock functions that wrap it eg session cache

## Testing page forms

- When testing validation errors, use `submitForm` to POST invalid data, then pass the returned `cookie` directly to `loadPage` — `submitForm` already extracts the session cookie from `set-cookie` headers. Assert on `response.statusCode` (303) and `response.headers.location` before loading the redirected page.
- When testing that a previous selection is persisted, submit valid data with `submitForm` and pass the returned `cookie` to a subsequent `loadPage` call.

## Using a running server in tests

- When a test needs a running server instance, use `setupTestServer` from `src/test-utils/setup-test-server.js` — it handles `beforeAll`/`afterAll` lifecycle, shares a single server instance across tests in the file, and ensures Redis is ready. Call the returned getter to get the server: `const getServer = setupTestServer()`, then `getServer()` inside tests.

## Using sessions in tests

- When a test needs a stable session ID (e.g. for rate limiting or any behaviour keyed on session), use `withValidQuoteSession` to prime a real server-side session and obtain a cookie. Pass that cookie to all subsequent `server.inject` calls so Yar reuses the same session ID across requests. Never hand-roll session priming via a `/__test-setup-*` helper route or by mocking session reads — drive the real routes to build session state.

## Signed-in pages

- Tests for pages behind `requireAuth` must use `setupSignedInTestServer` from `src/test-utils/setup-signed-in-test-server.js`, which provides the server and a sign-in function. Don't hand-roll the Defra ID MSW handlers or dynamically import the server or sign-in helpers in the test. If a test needs extra handlers, extend the helper rather than copying its contents.

## Module-level singletons

- When a module exports a lazy singleton (e.g. a rate limiter, cache client, or DB connection initialised on first call), tests that mutate its config must reset it in `beforeAll`/`afterAll`. Verify a reset/teardown function exists and is called at the appropriate lifecycle hook — otherwise the stale singleton persists across test files and config mutations have no effect.

## Testing DOM / HTML

- DOM testing library is used for querying the DOM, prefer that to native querySelector as it enables finding elements by ARIA role or associated label so builds in accessibility checks, for free
- Use `toBeInTheDocument()` (from `@testing-library/jest-dom`) rather than `toBeTruthy()` for DOM presence assertions — `getByTestId` etc. throw when absent, so `toBeTruthy()` is always true for present elements and adds no assertion value

## Test readability

- Test titles should be in readable English and avoid implementation details.
- Do not define fixtures, helper functions, or large data objects inline in test files. Extract them to `src/test-utils/` (helpers) or `src/test-utils/fixtures/` (data). This keeps test files focused on assertions and makes fixtures reusable across tests.
- Re-use fixture data across test files rather than duplicating it — this makes it easier to maintain data contracts, especially without TypeScript. Before writing a literal test value (NRL reference, email, ID, etc.), check `src/test-utils/fixtures/` for it and import it rather than retyping it.
- Test assertion blocks should begin with 'it' rather than 'test'
- Write parameterised tests up front to satisfy SonarQube. Two rules bite in CI if you don't:
  - **S5976** — when 3+ tests differ only in their input/expected values (same setup and assertions), use a single `it.each([...])` instead of separate `it(...)` blocks. Sonar fails the quality gate on the 3rd near-duplicate test.
  - **S1192** — a string literal repeated 3+ times (including in test data or expected values) must be extracted to a `const`. This also applies to non-test source.

## Config values in tests

- Do not assert on literal strings that are config defaults (e.g. a header name like `'x-cdp-request-id'`). Read the value from config instead, or mock config explicitly — otherwise the test passes even when config changes the value at runtime.
- Exception for unit tests of pure helpers: prefer asserting literal expected values (with config at its defaults) over mocking config — a mocked config only tests the mock.

## Concurrency

- Any operation that must happen at most once (token redemption, claiming a record) needs an acceptance test that fires several requests in parallel (`Promise.all`) against a real server and database, and asserts exactly one succeeds. Sequential "second attempt fails" tests do not catch races.
- Mock return values should contain only what the code under test reads. Don't copy driver artefacts into mocks (e.g. `{ '?column?': 1 }` for a `SELECT 1`) — use `[{}]`.

## Constants vs literals in expectations

- Don't take an *expected output* from the same constant the code under test reads — if the constant's value changes, code and test change together and the test still passes. Assert a literal when the value is a contract that outlives the code: something persisted (session values like the `whatWouldYouLikeToDo` journey), sent to another service, or shown to the user.
- Using a constant as *test input* (fixtures, setup) is fine either way: a stale literal input makes the test fail loudly, not pass falsely.
- Assert literal HTTP status codes and route paths, not constants: `expect(response.statusCode).toBe(302)` and `expect(response.headers.location).toBe('/manage/start-page')`, not `statusCodes.found` or an imported `routePath`. A constant shared with the code under test lets a wrong change pass silently (false positive). Do not flag literal status codes or paths in test expectations in review.

## Test performance

- Favour fast tests over extending test timeouts. If a test is slow because it repeats an operation many times to reach a threshold (e.g. firing 60+ requests to trip a rate limit), lower that threshold in the test environment via config (e.g. `default: isTest ? 5 : 60`) rather than raising the test's timeout. Extending the timeout hides slowness and makes the suite drag; reducing the work keeps the test fast and still proves the behaviour.

## Acceptance tests

- Assert the observable outcome the change delivers, not just the status code. If a change pre-fills an input, assert the input's value; if it shows a message, assert the message. A `200` alone passes when the behaviour is broken.
- Every page should have a acceptance test file in the same folder, named page.test.js, and a accessibility test, named accessibility.test.js.
