---
name: check-ac-test-coverage
description: Assess whether every acceptance-criteria scenario in a Jira ticket (or every story in a Jira epic) is covered by unit, integration or journey tests, across all submodules (not just one PR). TRIGGER when asked to check, audit or map test coverage against a ticket's or epic's ACs.
---

## Parameters

`args` is a Jira ticket or epic reference (e.g. `NRF2-1259`) or full URL. If given a URL, take the key from it.

- **Ticket:** use only the ACs of that ticket; ignore sub-tasks and linked tickets.
- **Epic:** assess every story in the epic, each against its own ACs, and report one table per story. Ignore sub-tasks and linked tickets of those stories.

Decide which it is in Step 1.

The skill runs the tests it cites, not only reads them (Step 4b). A test that reads as covering an AC but is failing, skipped or broken must not count as covered. Running needs Docker or a database for some suites and can take minutes; where the environment cannot run a file, record it as not run and carry on.

This skill never edits tests, code or the ticket. It writes only the report file in Step 5. It also runs tests (Step 4b), which must leave no files behind.

**Scope:** by default, assess only what is on disk now: the currently checked-out branch and working files (including uncommitted changes) in every submodule. Do not fetch, and do not read other branches or remote refs (`git show`, `origin/...`). Only do so if the user names a branch or ref in the args, and then say which ref you used. If the implementation for an AC is missing from the checkout, report its tests as Not covered and note that the work may be on an unchecked-out branch; do not go looking for it.

Prerequisites:
- `ATLASSIAN_USER` and `ATLASSIAN_TOKEN` set. See [atlassian-credentials.md](../../../docs/ai/atlassian-credentials.md). If either is unset, stop and tell the user.

## Steps

### Step 1 — Fetch the ACs

Use `util-read-jira-ticket` for the reference. If its issue type is `Epic`:

1. Run `node .ai/skills/tools/jira/get-epic-issues.mjs <epic>` to list the child issues. If it fails, stop and report the error.
2. Skip children that are sub-tasks or epics. Run `util-read-jira-ticket` on each remaining story.
3. Run Steps 2–5 (including 4b) once per story. Share implementation searches between stories where they overlap, but keep each story's ACs, evidence and table separate.
4. A story with no `Acceptance criteria` section is not a reason to stop: list it in the final summary as "no ACs" and move on.

Otherwise it is a single ticket. If there is no `Acceptance criteria` section, stop and tell the user.

List every AC as `AC1…ACn`. Current tickets use the simplified format — a single-line bold-label numbered item (`# *<Prefix>:* <sentence>`) — so the whole sentence is the one assertion to cover; treat the prefix as the heading. Older tickets may still use Given/When/Then: for those, use the heading and the `Then` line(s) as the assertion(s) to cover instead, and treat each distinct `Then` separately.

Mark an AC **manual-only** (not a gap) only if its assertion cannot be checked in code: copy matching a prototype, visual layout, or content taken from a design link. An assertion that states concrete content (e.g. "the page shows the heading 'Enter your email'") is automatable, so it is not manual-only.

### Step 2 — Locate the implementation

Do not scan test directories. From the ACs, extract the page names, URL paths, error messages, field names and behaviours (e.g. "saves answer", "redirects to…"). Search for these (route paths, controller/handler names, view models, page objects) to find the implementation. Use whatever code-navigation tooling is available; otherwise Grep. Record:
- the implementation symbols and their files (per submodule: `frontend`, `backend`, `admin-frontend`, `impact-assessor`, `journey-tests`)
- any test files that depend on them

If the first search is thin, try different terms (e.g. the URL path). Stop at three searches. If the implementation is still not found, mark the affected ACs Not covered with the note "implementation not found in checkout" and continue; do not ask the user.

### Step 3 — Build the candidate test list

Candidate tests are the union of:
1. Test files that depend on the implementation symbols (unit and integration, colocated `*.test.js` / `test_*.py`). Grep the implementation file names and symbol names across test files.
2. Journey tests: Grep `journey-tests/` for the page's URL path and its page-object name. Page objects are shared, so a hit in a `.feature` file or step definition that uses the page object counts.
3. Cross-cutting tests: global hooks, middleware, plugins and shared session helpers that enforce a behaviour the AC relies on (e.g. cache headers for back navigation) are not linked to the page's symbols. Search for them by behaviour, not by page name. Typical places: plugin and middleware tests, `server.inject` tests asserting response headers or redirects, and the shared guard / session helper tests.
4. Backend/API tests: Grep `backend/` and `impact-assessor/` test files for the endpoint path.

Use Grep with `output_mode: files_with_matches` first. Do not read test files yet.

### Step 4 — Outline, then verify

For each candidate test file, Grep with `output_mode: content` and line numbers for `describe(|it(|test(|def test_` to get titles cheaply. Shortlist titles that plausibly match an AC.

Journey tests are Cucumber features, not `describe`/`it` files: they live in `journey-tests/test/features/**/*.feature`, with steps in `journey-tests/test/step-definitions/`. Outline them with `Grep` for `^\s*(Feature|Scenario|Scenario Outline):` and read the matching scenario's `Given`/`When`/`Then`/`And` lines (and, for a step that does the asserting, its step definition). A journey test is read only: it is not run (Step 4b).

For each shortlisted test, Read only that test's body (use the line number from the Grep as `offset`, with a `limit`); never read whole test files. Judge from the **assertions**, not the title: does it set up the trigger and assert the AC's sentence (or, for a Given/When/Then AC, the `Then`)? A title that claims coverage with no matching assertion is not coverage.

Read about 3 tests per AC, more if the AC has several distinct assertions (about 3 per assertion). If the cap stops you before every assertion is verified, mark the AC Partial and say which were not checked. If more tests exist than the cap allows, pick the one per layer that best matches. Follow the layer order in Test pyramid below.

### Step 4b — Run the shortlisted tests

Reading an assertion shows what a test would check, not that it passes today. Run the test files, once per file, so a status of Covered means the assertion is asserted and holds.

Run after the Step 4 outline has shortlisted files, not before. Before the outline you do not know which files matter, and running whole suites would be slow and mostly irrelevant. Start the runs in the background as soon as the shortlist exists, then read test bodies while they run, so the two overlap. Use the run's verbose output (`--reporter=verbose` for vitest, `-v` for pytest) as a cross-check on the titles you copy: a title that does not appear in the output is a title you got wrong or a test that did not run.

Pick the command by repo, run it from inside that repo, and keep coverage and cache files from being written (they would dirty the working tree):

| Repo | Command |
|------|---------|
| `frontend`, `backend` | `TZ=UTC npx vitest run <test file> --coverage.enabled=false` |
| `admin-frontend` | `AWS_EMF_ENVIRONMENT=Local TZ=UTC npx vitest run <test file> --coverage.enabled=false` |
| `impact-assessor` unit tests | `uv run pytest <test file> --no-cov -p no:cacheprovider` |
| `impact-assessor` integration tests (under `tests/integration/`) | `uv run pytest <test file> -m integration --no-cov -p no:cacheprovider` |
| `journey-tests` | Do not run: they need the full compose stack and a browser. Record "not run". |

Rules:
- `frontend` and `backend` suites start a Redis container, and `impact-assessor` integration tests need the `test_nrf_impact` Postgres database. Before the first such run, check that Docker (`docker info`) or the database is reachable. If not, do not try to start services: record those files as "not run" with the reason, and carry on.
- Run files, not single tests, and run independent files in parallel. Give each command a timeout of 5 minutes. If it times out, record "not run (timeout)".
- Record the result of each cited test, matched by title: pass, fail, skipped (an `it.skip`, `it.todo` or `pytest.skip` counts) or not run.
- A failure caused by the environment, not the test, is "not run": a missing dependency (`Cannot find package ...`, `ModuleNotFoundError`), a missing `node_modules` or `.venv`, or a service that is down. Do not run `npm install` or `uv sync`; say which dependency is missing so the user can install it. Only a failure in the test's own code or the code it exercises is a fail. A syntax error in the test file itself is a fail for every test in it.
- Do not fix a failing test or change the code. Report it.
- Afterwards run `git status --short` in each repo you ran tests in and compare with before. If a run left new files (coverage output, caches), delete only those files and say so in the report.

How the result changes the status:
- A cited test that fails or is skipped does not assert the AC. Drop it from the covering set. If no other passing test asserts the AC, mark it Partial (the assertion exists but fails or is skipped) and say so in Summary, with the failure's first decisive line quoted.
- A test that is not run (no Docker, timeout, journey) keeps the status from reading, but set Confidence to Medium at most and name why in Gap / note.

### Step 5 — Report

Write the report to `docs/ac-test-coverage-results/YYYY-MM-DD-<key>.md` (today's date; the ticket or epic key). Create the folder if missing. Then reply in the chat with only: the file path, the count line, and the gaps that need a test (one line each). Do not paste the matrix into the chat; the file is the report. Whoever reads it is a developer deciding what test to write next, so put the actions first and keep the matrix scannable.

Use exactly this layout, so reports from different runs compare:

```
# AC test coverage: <key> — <summary>

Date: <YYYY-MM-DD>
Ticket: <url> (<type>, <status>)
Scope: <branch checked out, or the ref the user named>. No other branches or remote refs were read.

## Summary

<n> Covered, <n> Partial, <n> Not covered, <n> Manual-only.

<Numbered list of gaps, one per Partial or Not covered AC: the AC id, what no test asserts, and the test to add with the file it belongs in. Write "No gaps." if there are none.>

## Matrix

<table>

## Journey tests

<What journey tests exist for this behaviour, and whether any is recommended and why. One or two sentences.>

## How this was run

<Submodules searched with branch; the grep commands used, in code blocks, so the user can rerun them. Also the test commands run and what was not run and why.>

## Caveat

<Matching is a judgement from reading assertions, not measured coverage; tests not reachable via the searches may be missed. Name every AC with Low confidence, and the Medium ones.>
```

For an epic: one file named for the epic key. Under `## Matrix`, give each story its own `### <story key> — <story summary>` heading, table and count line. Put a one-line-per-story summary (story key, counts, or "no ACs") at the top of `## Summary`, then the numbered gaps grouped by story. Keep the other sections once per file.

The matrix has one row per test that asserts an AC, so a reader can see each test next to what it proves:

| AC | Scenario | Status | Test description | Evidence | Run | Gap / note | Confidence |
|----|----------|--------|------------------|----------|-----|------------|------------|

- AC, Scenario, Status and Confidence: fill them on the AC's first row only and leave them empty on its other rows. Scenario is a few words, not the whole assertion.
- Test description: the test's title string, copied character for character from the `describe`/`it`/`test` call, or the `def test_` name, on the line you cite in Evidence. Take it from the line you Read in Step 4, not from memory or an outline fragment. For a nested test, give `describe title > it title`. For a journey test, use this format, with the Feature title, the Scenario title and the steps that assert the AC, each copied exactly: `"<Feature title>" scenario: "<Scenario title>" (steps <step>, <step>)`, e.g. `"Request to use journey when already signed in with Defra ID" scenario: "Signed-in employee skips the question about who they are requesting for" (steps When I sign out, Then I should be signed out of the service and Defra ID)`. Evidence points to the `Scenario:` line in the `.feature` file. Put a JS title in quotes, e.g. `"redirects to sign-in when the session has expired"`, and a Python name in backticks. Give one title per row: never join two, never use `...` or paraphrase. A parameterised title keeps its `%s`. If you did not read the title, Read the line now before writing the row.
- Evidence: that one test as `repo/path/to/file:line (layer)`.
  - Prefix the path with the repo it belongs to: `frontend`, `backend`, `admin-frontend`, `impact-assessor` or `journey-tests`.
  - `layer` is one of `unit`, `integration` or `journey`. Use it as the only annotation: no explanation in brackets or after the file name.
  - Example: `frontend/src/server/quote/email/controller.test.js:42 (integration)`
- Run: `pass`, `fail`, `skipped` or `not run`, from Step 4b.
- Gap / note: one short sentence on what this test asserts for the AC, or what it leaves out. Base it on the assertions in the body you Read, and mention every step the body checks that matters to the AC (a test that saves, signs out, signs back in and checks the field is empty asserts all of that, not only its first step). Per-test, so each row stays independent. Do not repeat the AC-level gap on every row: put it in the Summary and write "See Summary 1." on the AC's last row.
- List at most 4 tests per AC, the ones that best assert it, lowest layer first. An AC with no test gets a single row with the Test description "none found" and empty Evidence.
- Config values and defaults (a TTL, a limit, a flag): quote them from the file you Read, with `path:line`. Do not report one from memory or from another run.
- Confidence: High, Medium or Low, on the first row. Use Low where matching relied on inference or the read cap, and say why in that row's Gap / note.

Status:
- **Covered** — each assertion is asserted by at least one test.
- **Partial** — some assertions asserted, or the AC is cross-service and is asserted only with the other service mocked and no journey test (see Test pyramid). Say which part is missing.
- **Not covered** — no test asserts it.
- **Manual-only** — not automatable; say why.

#### Test pyramid

Prefer the lowest layer that can genuinely assert the AC. Check unit tests first, then integration, and look at journey tests only if those do not already assert the AC or the AC is cross-service. Journey tests are slow and expensive, so they are the last resort, not the default.

- **Unit and integration tests (frontend and backend)** — the default home for validation, view models, handlers, session behaviour, redirects, guards, back links and re-shown answers. The frontend and backend test suites run against a real Redis container and use `server.inject`, so redirects, cookies and session state across several requests can be tested realistically. Persistence, API contracts and data belong in backend integration tests.
- **Journey tests** — only for behaviour that is cross-service (e.g. a frontend request that reaches the real backend, email delivery, the uploader), needs a real browser (history stack, client-side JavaScript such as the map), or is a genuinely complex multi-step flow that lower layers cannot reproduce.

A scenario that traverses several pages (change links, back links, dropout pages) and then checks a saved session value is not automatically a journey test. If it can be written as a chain of `server.inject` requests carrying the session cookie, assert it as one chained integration test. Per-hop tests of each page do not count as covering the chain. Only if the chain is very complex (many requests, branching state, or hard to set up and read) is a journey test justified instead; say that is the reason.

Rules for applying this:
- A missing journey test is **not** a gap when a unit or integration test already asserts the AC. Mark the AC Covered and cite the lower-layer test. Only a cross-service AC can be Partial for lacking a journey test; never mark any other AC Partial for that reason.
- Before recommending any new journey test, look for existing lower-layer tests of the same behaviour. Search the page's colocated `*.test.js` files and the shared guard/session helper tests for the same trigger and outcome, not just the same page. Name what you found in the report.
- Recommend a journey test only if the AC is cross-service, needs a real browser, or is a very complex chain, and say which of those reasons applies. If it is none of these, recommend the missing unit or integration test instead (a chained `server.inject` test for multi-page session scenarios) and say where it belongs.
- A multi-page AC whose hops are each asserted but whose chained outcome (e.g. the saved answer after going back) is not asserted anywhere is Partial. Name the missing chained integration test.
- Do not recommend a journey test that would only repeat an assertion already made at a lower layer, however convincing the end-to-end framing.
