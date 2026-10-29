---
name: test-in-browser
description: Test a feature in the browser against Jira acceptance criteria
allowed-tools: Bash, Read, playwright_browser_navigate, playwright_browser_navigate_back, playwright_browser_snapshot, playwright_browser_evaluate, playwright_browser_run_code_unsafe, playwright_browser_click, playwright_browser_type, playwright_browser_fill_form, playwright_browser_press_key, playwright_browser_wait_for, playwright_browser_close, playwright_browser_console_messages, playwright_browser_network_requests, playwright_browser_take_screenshot, mcp__playwright__browser_navigate, mcp__playwright__browser_navigate_back, mcp__playwright__browser_snapshot, mcp__playwright__browser_evaluate, mcp__playwright__browser_run_code_unsafe, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_fill_form, mcp__playwright__browser_press_key, mcp__playwright__browser_wait_for, mcp__playwright__browser_close, mcp__playwright__browser_console_messages, mcp__playwright__browser_network_requests
---

## Parameters

`args` is a space-separated string: `<ticket> <url>`

- First token: Jira ticket number, e.g. `NRF2-358`
- Remainder: starting URL, e.g. `http://localhost:3000/`. If omitted, default to `http://localhost:3000/`.

## Project context

- **Framework:** Hapi.js with Nunjucks templates
- **Cookies:** HttpOnly — cannot be inspected via JS
- **CSRF:** All form POSTs are CSRF-protected — never POST via `fetch`
- **Bot filtering (deployed environments):** Deployed environments (e.g. `*.cdp-int.defra.cloud`) run a bot filter that suppresses page content for headless/scanner user agents. Playwright's default UA contains `HeadlessChrome`, so it gets treated as a scanner: requests return **200 with an empty page body (heading only, no content or error)** and do **not** consume a magic-link session. This silently breaks every scenario and looks like a content/render bug. **Always set a real-browser UA before testing on a deployed environment** — see "User agent" below.
- **Jira:** `https://eaflood.atlassian.net/browse/<ticket>`
- **Local environment (localhost targets):** When testing against `localhost`, more than the browser is available for setup and verification — these still count as black-box exceptions, so note any use in the results table:
  - **Docker logs:** `docker compose logs <service> --since <duration>` to confirm backend behaviour (e.g. that an email send was triggered, or that one was _not_).
  - **Postgres DB:** `docker compose exec -T postgres psql -U postgres -d <db> -c "<SQL>"` to inspect or set up test state directly (e.g. expiring/exhausting a token to reach a state a user can't reach manually).
  - **Notify API:** emails can be verified against the GOV.UK Notify API (real key locally, not a stub). See `journey-tests/test/support/find-notify-email.js` for how to query notifications by recipient, status, body text, and a `sentAfter` cutoff. Use this to confirm email content (subject/body) or that no email was sent.
- **Deployed environments (signed-in scenarios):** Real Defra ID sign-in works on deployed non-prod environments. Use the accounts on the [Test users (non-prod)](https://eaflood.atlassian.net/wiki/spaces/NRFDT/pages/6575620298) Confluence page (sign-in link, shared password and users are there; never copy credentials into the repo or output). Don't mark signed-in scenarios as untestable. Note the sign-in in the results table as a black-box exception.
  - **No authenticator app is needed:** Despite the "Authenticator QR" column on that page, signing in as a GOV.UK One Login test user is only email then password, with no second-factor prompt. Go to `<base-url>/profile`, choose "Sign in with GOV UK One Login", Continue, Sign in, enter the email, Continue, enter the password, Continue; you land back on `/profile`. Do this with `mcp__playwright__browser_run_code_unsafe`. Never mark a signed-in scenario untestable or Partial on the assumption that MFA blocks you. Only report a blocker after you have actually attempted the sign-in and seen what stopped you.
- **Deployed environments (request-to-use journey):** The request-to-use pages are only reachable with a real NRL reference and the emailed link. Use the tools in `.ai/skills/tools/notify/` (they read `NOTIFY_API_KEY` from the environment or `compose.override.yml` and never print it). Test emails go to `nrfjourneytests@gmail.com`. Note any use in the results table as a black-box exception.
  - **Start the journey (about 10s, no browser calls):** `node .ai/skills/tools/notify/seed-request-to-use.mjs <base-url> nrfjourneytests@gmail.com` creates a quote over HTTP, requests the retrieve-quote email, reads it from Notify and prints `{"reference","retrieveUrl"}`. Open `retrieveUrl` in the browser (it is single-use, so each run needs a fresh one and the script never follows it). You land on `/request-to-use/review-quote-details`; Continue, then choose Yes on `accept-levy` to reach the next pages.
  - **Reading an email:** `find-email.mjs <email> "<text>" <sentAfterISO>` prints the first matching email body (e.g. the quote email, which links to `/request-to-use/enter-nrl-reference?nrlReference=...`).
- **Playwright console & network:** `mcp__playwright__browser_console_messages` and `mcp__playwright__browser_network_requests` are available to inspect client-side errors and HTTP traffic — see "Error monitoring".
- **Browser:** Use only the Playwright MCP tools (`mcp__playwright__browser_navigate`, `mcp__playwright__browser_snapshot`, `mcp__playwright__browser_evaluate`, `mcp__playwright__browser_run_code_unsafe`, `mcp__playwright__browser_close`, etc.). Never use Chrome DevTools MCP tools (`mcp__plugin_chrome-devtools-mcp_chrome-devtools__*`). If Playwright MCP tools are not available, stop immediately and report this to the user.

## ⛔ Black-box rule — don't read source code unless necessary

**Default to the browser alone, exactly as a user would.** Don't read source files, config files, or implementation code to find a URL, a selector, or to debug a failure — if a user can't see it, neither should you.

Exceptions are limited to cases where the AC genuinely can't be verified from the browser alone:

- Things physically unobservable in a browser (e.g. `HttpOnly` / `Secure` cookie flags, server-set cookie expiry).
- Named implementation details the AC depends on (e.g. specific cookie names to assert presence/absence of, a policy version field, a config flag or env var used to simulate a state a user can't reach).
- Test hooks the implementer has provided to make an AC testable — prefer using these over skipping the scenario. The ticket's testing notes are the expected channel for the implementer to surface these; check there first before reading code.

When you rely on code-derived knowledge, mark the row as "code-verified" in the results table and note exactly what you looked up. Every code read must be visible in the output.

## Setup

Confirm the Playwright MCP server is configured with a real-browser user agent before proceeding — see "User agent" under Browser testing. Otherwise the bot filter silently returns empty pages to Playwright's default headless UA.

Do steps 1 and 2 **in parallel** — issue both calls in the same message so the browser is already loaded by the time Jira is read:

1. Invoke the `read-jira-ticket` skill with the ticket ID to fetch the ticket's details.

2. Navigate to the test URL with `mcp__playwright__browser_navigate`.

Once both complete: confirm the correct page loaded via `mcp__playwright__browser_snapshot`, then extract every scenario as a numbered checklist before proceeding.

**If any scenario or acceptance criterion is unclear, ambiguous, or untestable** (e.g. missing expected values, vague assertions, or steps that can't be verified in a browser), flag it to the user before testing that scenario. Ask for clarification rather than guessing. Note any assumptions you had to make in the results table. A password prompt on a prototype link is not a reason to flag or skip — use the `browse-prototype` skill (see "Prototype comparison").

## Prototype comparison

If any acceptance criterion links to a prototype page or prototype error state (e.g. "content should match the prototype", "error summary as shown on the prototype error state"), **use the `browse-prototype` skill to get the expected content. Do not navigate to prototype URLs yourself.** The prototype is password-protected; `browse-prototype` handles the password prompt using the `PROTOTYPE_PASSWORD` env var and extracts the page with the project's extraction script. Never ask the user for the password or paste it into the conversation.

- Run it once per linked prototype URL during Setup, before testing scenarios, because it drives the same Playwright browser. Hold the extracted JSON in memory, then navigate back to the test URL.
- For error-state criteria, ask it to capture the error state (its Step 3). The error summary link text is the source of truth for expected error wording.
- Compare the deployed page against the extracted heading, body content, radio/checkbox labels and values, hints, button text and error wording. The extraction script skips the back link, per-item hints, inset text, warning text, tables and details — check those against the prototype's DOM directly.
- Differences that don't affect what a user sees (e.g. error summary anchor `href` casing, the back link's route) are not failures; mention them in the Notes column.
- Never fetch the prototype with `curl` or your own scripts. Use only `browse-prototype`, which drives the browser and logs in with `PROTOTYPE_PASSWORD`. For the items the extractor skips (warning text, details, lists, back link), compare against the prototype page's DOM in the browser.
- If `browse-prototype` fails (e.g. `PROTOTYPE_PASSWORD` is unset), report the exact error and mark prototype-dependent scenarios ⚠️ Partial, with the reason in Notes. Don't guess the expected content.

## Progress narration

Output one short line before every tool call. Announce each scenario by title only (no markdown headings). After each scenario output `"Scenario N done — PASS"` or `"Scenario N done — FAIL: <reason>"`. If a tool call is slow, output `"Waiting for browser — <tool name>..."`. If a tool call errors, output `"FAILED: <tool name> — <error>. Stopping this scenario."`.

## Browser testing

**User agent:** On deployed environments the bot filter (see Project context) blanks the page for Playwright's default `HeadlessChrome` UA. The fix is to pass `--user-agent` to the Playwright MCP server so it applies globally to every session — add it to the server's args in `~/.claude.json` (user scope) or via `claude mcp add`:

```
--user-agent "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
```

Restart Claude Code after changing MCP server args for them to take effect.

**Clean state:** Use `mcp__playwright__browser_navigate` to reset state between scenarios. Don't try to clear HttpOnly cookies via JS — it won't work. Don't POST via `fetch` — CSRF will block it. Note any cookie-state limitations in the results table.

**Signed-out scenarios:** If a scenario needs a signed-out user and you land on a signed-in page, there is a "Sign out" link in the header. Select it before testing the scenario.

To fully clear all cookies (including HttpOnly/server-set ones), use Playwright's context API:

```js
// via mcp__playwright__browser_run_code_unsafe:
;async (page) => {
  await page.context().clearCookies()
  return 'cookies cleared'
}
```

**Assertions:** Prefer `mcp__playwright__browser_evaluate` — fast and precise. Only use `mcp__playwright__browser_snapshot` when you need to discover an unknown selector. Don't take screenshots.

**Browser tool errors:** Retry once. If the retry fails, stop and wait for the user.

## Landing on a page that may not be built yet

If an AC is about landing on another page (e.g. "I am taken to the enter email page"), judge it by the browser URL alone. If the URL matches the path in the AC, the scenario is ✅ Pass, even if the page itself is a 404 or "Page not found" — the destination may belong to a story that hasn't been built yet. Don't fail or mark it ⚠️ Partial for that. Add a note to the result, e.g. "Lands on `/request-to-use/enter-email` as expected; page returns 404 (not built yet)".

This only covers the destination page's existence. Content, errors and other behaviour on the destination page are still tested when the page loads, and a URL that doesn't match the AC is still a fail.

Don't list these in the Jira comment as not passing, since they count as passed.

## Error monitoring

After each scenario, check for client-side errors using `mcp__playwright__browser_console_messages` and `mcp__playwright__browser_network_requests`. Flag in the Notes column:

- Console errors or warnings (ignore info/debug level)
- Failed network requests (4xx/5xx responses, or requests that never completed). A 404 from a destination page that isn't built yet (see "Landing on a page that may not be built yet") is noted on that scenario but is not a failure.

## Cleanup

Close the browser with `mcp__playwright__browser_close` after all scenarios.

## Output format

Results table only — no preamble. List bugs/gaps below the table.

| Scenario | Description | Result                                            | Notes |
| -------- | ----------- | ------------------------------------------------- | ----- |
| 1        | ...         | ✅ Pass / ❌ Fail / ⚠️ Partial / 🔍 Code-verified | ...   |

## Jira comment

Only add a Jira comment if the starting URL is a deployed environment. If it is `localhost` (local development), skip this section and don't post anything to the ticket.

After the results table, add a comment to the Jira ticket confirming the browser test was run. Keep it concise: plain text, no table, no per-scenario detail for passing scenarios.

- All scenarios passed: `Browser tested against <url> on <date>: all <N> acceptance criteria passed.`
- Otherwise: `Browser tested against <url> on <date>: <P> of <N> acceptance criteria passed. Did not pass:` followed by one line per failed or partial scenario, `- Scenario <n> - <title>: <short reason>`.

Always start the comment with `Browser tested against` and post it with `echo "<comment>" | node .ai/skills/tools/jira/add-comment.mjs <ticket> --replace-prefix "Browser tested against" -`. If this is a re-run, that replaces your earlier browser-test comment on the ticket rather than adding another (and removes older duplicates), so the ticket only ever carries the latest result. Don't mention earlier runs in the new comment. If the script fails, report the exact error and don't retry or call the Jira API directly.
