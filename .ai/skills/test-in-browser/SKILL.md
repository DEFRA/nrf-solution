---
name: test-in-browser
description: Test a feature in the browser against Jira acceptance criteria
allowed-tools: Bash, Read, playwright_browser_navigate, playwright_browser_navigate_back, playwright_browser_snapshot, playwright_browser_evaluate, playwright_browser_run_code_unsafe, playwright_browser_click, playwright_browser_type, playwright_browser_fill_form, playwright_browser_press_key, playwright_browser_wait_for, playwright_browser_close, playwright_browser_console_messages, playwright_browser_network_requests, playwright_browser_take_screenshot, mcp__playwright__browser_navigate, mcp__playwright__browser_navigate_back, mcp__playwright__browser_snapshot, mcp__playwright__browser_evaluate, mcp__playwright__browser_run_code_unsafe, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_fill_form, mcp__playwright__browser_press_key, mcp__playwright__browser_wait_for, mcp__playwright__browser_close, mcp__playwright__browser_console_messages, mcp__playwright__browser_network_requests, mcp__playwright__browser_take_screenshot
---

## Parameters

`args` is a space-separated string: `<ticket> <url>`

- First token: Jira ticket number, e.g. `NRF2-358`
- Remainder: starting URL, e.g. `http://localhost:3000/`. If omitted, default to `http://localhost:3000/`.

## Project context

- **Framework:** Hapi.js with Nunjucks templates
- **Cookies:** HttpOnly — cannot be inspected via JS
- **CSRF:** All form POSTs are CSRF-protected — never POST via `fetch`
- **Jira:** `https://eaflood.atlassian.net/browse/<ticket>`
- **Browser:** Use only the Playwright MCP tools (`mcp__playwright__browser_navigate`, `mcp__playwright__browser_snapshot`, `mcp__playwright__browser_evaluate`, `mcp__playwright__browser_run_code_unsafe`, `mcp__playwright__browser_close`, etc.). Never use Chrome DevTools MCP tools (`mcp__plugin_chrome-devtools-mcp_chrome-devtools__*`). If Playwright MCP tools are not available, stop immediately and report this to the user.
- **Environment:** the target URL decides what extra setup is available or required. **Before Setup, read [references/environments.md](references/environments.md)** for the matching section:
  - `localhost`: Docker logs, Postgres and the Notify API are available.
  - Any deployed environment (e.g. `*.cdp-int.defra.cloud`): a real-browser user agent is **required**, otherwise the bot filter returns 200 with an empty page and every scenario silently fails. Also covers signing in for signed-in scenarios and starting the request-to-use journey.

## ⛔ Black-box rule — don't read source code unless necessary

**Default to the browser alone, exactly as a user would.** Don't read source files, config files, or implementation code to find a URL, a selector, or to debug a failure — if a user can't see it, neither should you.

Exceptions are limited to cases where the AC genuinely can't be verified from the browser alone:

- Things physically unobservable in a browser (e.g. `HttpOnly` / `Secure` cookie flags, server-set cookie expiry).
- Named implementation details the AC depends on (e.g. specific cookie names to assert presence/absence of, a policy version field, a config flag or env var used to simulate a state a user can't reach).
- Test hooks the implementer has provided to make an AC testable — prefer using these over skipping the scenario. The ticket's `h2. Testing notes` section is the expected channel for these, and for test users, test data and how to test changes a browser can't exercise (see [ac-testability.md](../../../docs/ai/ac-testability.md)); check there first before reading code. If an AC needs something the notes don't give, report it as a gap rather than guessing.

When you rely on code-derived knowledge, mark the row as "code-verified" in the results table and note exactly what you looked up. Every code read must be visible in the output. The same applies to Docker logs, database queries and Notify lookups: note any use in the results table as a black-box exception.

## Setup

For a deployed target, confirm the Playwright MCP server has a real-browser user agent before proceeding (see [references/environments.md](references/environments.md#bot-filter-and-user-agent)).

Do steps 1 and 2 **in parallel** — issue both calls in the same message so the browser is already loaded by the time Jira is read:

1. Invoke the `util-read-jira-ticket` skill with the ticket ID to fetch the ticket's details.

2. Navigate to the test URL with `mcp__playwright__browser_navigate`.

Once both complete: confirm the correct page loaded via `mcp__playwright__browser_snapshot`, then extract every scenario as a numbered checklist before proceeding.

**Testability check (non-blocking).** Before testing, check every AC against [ac-testability.md](../../../docs/ai/ac-testability.md). If any AC fails, list the failing ACs with the reason for each, then proceed with testing anyway. Mark the affected scenarios ⚠️ Partial in the results where you couldn't fully verify them, and repeat the testability issues below the results table. Don't guess missing expected values. Note any assumptions you do make in the results table. A password prompt on a prototype link is not a reason to flag or skip.

**Prototype links.** If any AC links to a prototype page or error state, **read [references/prototype-comparison.md](references/prototype-comparison.md) and follow it during Setup**, before testing scenarios. Never navigate to prototype URLs yourself.

## Progress narration

Output one short line before every tool call. Announce each scenario by title only (no markdown headings). After each scenario output `"Scenario N done — PASS"` or `"Scenario N done — FAIL: <reason>"`. If a tool call is slow, output `"Waiting for browser — <tool name>..."`. If a tool call errors, output `"FAILED: <tool name> — <error>. Stopping this scenario."`.

## Browser testing

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

## Error monitoring

After each scenario, check for client-side errors using `mcp__playwright__browser_console_messages` and `mcp__playwright__browser_network_requests`. Flag in the Notes column:

- Console errors or warnings (ignore info/debug level)
- Failed network requests (4xx/5xx responses, or requests that never completed). A 404 from a destination page that isn't built yet (see "Landing on a page that may not be built yet") is noted on that scenario but is not a failure.

## Cleanup

Close the browser with `mcp__playwright__browser_close` after all scenarios.

## Output format

In the session output, give the results table only — no preamble. List bugs/gaps below the table. This is separate from the Jira comment.

| Scenario | Description | Result                                            | Notes |
| -------- | ----------- | ------------------------------------------------- | ----- |
| 1        | ...         | ✅ Pass / ❌ Fail / ⚠️ Partial / 🔍 Code-verified | ...   |

## Jira comment

After the results table, **read [references/jira-comment.md](references/jira-comment.md)**. It gives the rules for when to comment (only on `https://nrf-frontend.test.cdp-int.defra.cloud/`), the exact wording and the posting command. For any other URL, post nothing to the ticket.
