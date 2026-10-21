---
name: check-ac-test-coverage
description: Assess whether every acceptance-criteria scenario in a Jira ticket is covered by unit, integration or journey tests, across all submodules (not just one PR). TRIGGER when asked to check, audit or map test coverage against a ticket's ACs.
---

## Parameters

`args` is a Jira ticket reference (e.g. `NRF2-1259`) or full URL. If given a URL, take the key from it.

This skill is read-only: do not edit tests, code or the ticket.

**Scope:** by default, assess only what is on disk now: the currently checked-out branch and working files (including uncommitted changes) in every submodule. Do not fetch, and do not read other branches or remote refs (`git show`, `origin/...`). Only do so if the user names a branch or ref in the args, and then say which ref you used. If the implementation for an AC is missing from the checkout, report its tests as Not covered and note that the work may be on an unchecked-out branch; do not go looking for it.

Prerequisites:
- `ATLASSIAN_USER` and `ATLASSIAN_TOKEN` set. See [atlassian-credentials.md](../../../docs/ai/atlassian-credentials.md).

## Steps

### Step 1 — Fetch the ACs

Use `read-jira-ticket`. If there is no `Acceptance criteria` section, stop and tell the user.

List every scenario as `AC1…ACn` with its heading and its Given / When / Then. Treat each distinct `Then` assertion as something to cover. Mark an AC **manual-only** (not a gap) if it can only be checked by eye: copy matching a prototype, visual layout, or content from a design link.

### Step 2 — Locate the implementation

Do not scan test directories. From the ACs, extract the page names, URL paths, error messages, field names and behaviours (e.g. "saves answer", "redirects to…"). Search for these (route paths, controller/handler names, view models, page objects) to find the implementation. Use whatever code-navigation tooling is available; otherwise Grep. Record:
- the implementation symbols and their files (per submodule: `frontend`, `backend`, `admin-frontend`, `impact-assessor`, `journey-tests`)
- any test files that depend on them

If the first search is thin, try different terms (e.g. the URL path). Stop at three searches.

### Step 3 — Build the candidate test list

Candidate tests are the union of:
1. Test files that depend on the implementation symbols (unit and integration, colocated `*.test.js` / `test_*.py`). Grep the implementation file names and symbol names across test files.
2. Journey tests: Grep `journey-tests/` for the page's URL path and its page-object name. Page objects are shared, so a hit in a spec file that uses the page object counts.
3. Cross-cutting tests: global hooks, middleware, plugins and shared session helpers that enforce a behaviour the AC relies on (e.g. cache headers for back navigation) are not linked to the page's symbols. Search for them by behaviour, not by page name.
4. Backend/API tests: Grep `backend/` and `impact-assessor/` test files for the endpoint path.

Use Grep with `output_mode: files_with_matches` first. Do not read test files yet.

### Step 4 — Outline, then verify

For each candidate test file, Grep for `describe(|it(|test(|def test_` with line numbers to get titles cheaply. Shortlist titles that plausibly match an AC.

For each shortlisted test, Read only that test's body (use `offset` / `limit`). Judge from the **assertions**, not the title: does it set up the Given, perform the When, and assert the Then? A title that claims coverage with no matching assertion is not coverage.

Cap at about 3 tests read per AC. If more exist, pick the one per layer that best matches. Check the lowest layers first (unit, then integration) and only look at journey tests for an AC if those do not already assert the Then, or if the AC is cross-service (see Test pyramid below).

### Step 5 — Report

A matrix, one row per AC:

| AC | Scenario | Status | Evidence (`file:line`, layer) | Gap / note |
|----|----------|--------|-------------------------------|------------|

Status:
- **Covered** — each Then is asserted by at least one test.
- **Partial** — some Thens asserted, or asserted only at a layer too low for what the AC needs (e.g. an AC about a frontend-to-backend request tested only with the backend call mocked, and no journey test). Say which part is missing.
- **Not covered** — no test asserts it.
- **Manual-only** — not automatable; say why.

#### Test pyramid

Prefer the lowest layer that can genuinely assert the Then. Journey tests are slow and expensive, so they are the last resort, not the default.

- **Unit and integration tests (frontend and backend)** — the default home for validation, view models, handlers, session behaviour, redirects, guards, back links and re-shown answers. The frontend and backend test suites run against a real Redis container and use `server.inject`, so redirects, cookies and session state across several requests can be tested realistically. Persistence, API contracts and data belong in backend integration tests.
- **Journey tests** — only for behaviour that is cross-service (e.g. a frontend request that reaches the real backend, email delivery, the uploader) or genuinely complex multi-step flow that lower layers cannot reproduce.

Rules for applying this:
- A missing journey test is **not** a gap when a unit or integration test already asserts the Then. Mark the AC Covered and cite the lower-layer test. Never mark an AC Partial just because no journey test exists.
- Before recommending any new journey test, look for existing lower-layer tests of the same behaviour. Search the page's colocated `*.test.js` files and the shared guard/session helper tests for the same Given / When / Then, not just the same page. Name what you found in the report.
- Recommend a journey test only if the AC is cross-service or complex, and say which of those reasons applies. If it is neither, recommend the missing unit or integration test instead and say where it belongs.
- Do not recommend a journey test that would only repeat an assertion already made at a lower layer, however convincing the end-to-end framing.

Finish with:
1. A one-line count (`n Covered, n Partial, n Not covered, n Manual-only`).
2. The submodules searched with the branch checked out in each, and the searches or queries used, so the user can rerun them.
3. A caveat that matching is a judgement from reading assertions, not measured coverage, and that tests not reachable via the searches above may have been missed. Name any AC where you are least sure.
