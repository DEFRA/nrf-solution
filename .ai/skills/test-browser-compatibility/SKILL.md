---
name: test-browser-compatibility
description: Run the quote journey across five Playwright MCP browser targets (desktop Chrome/Firefox/WebKit, iOS Safari and Android Chrome emulation), capture per-target evidence, and write a compatibility report with a production-readiness recommendation.
allowed-tools: Bash, Read, playwright_browser_navigate, playwright_browser_navigate_back, playwright_browser_snapshot, playwright_browser_evaluate, playwright_browser_run_code_unsafe, playwright_browser_click, playwright_browser_type, playwright_browser_fill_form, playwright_browser_press_key, playwright_browser_wait_for, playwright_browser_close, playwright_browser_console_messages, playwright_browser_network_requests, playwright_browser_take_screenshot, playwright_browser_resize, playwright_browser_file_upload, playwright_browser_find, mcp__playwright__browser_navigate, mcp__playwright__browser_find, mcp__playwright__browser_navigate_back, mcp__playwright__browser_snapshot, mcp__playwright__browser_evaluate, mcp__playwright__browser_run_code_unsafe, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_fill_form, mcp__playwright__browser_press_key, mcp__playwright__browser_wait_for, mcp__playwright__browser_close, mcp__playwright__browser_console_messages, mcp__playwright__browser_network_requests, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_resize, mcp__playwright__browser_file_upload, mcp__playwright__browser_find, mcp__playwright-firefox__browser_navigate, mcp__playwright-firefox__browser_find, mcp__playwright-firefox__browser_navigate_back, mcp__playwright-firefox__browser_snapshot, mcp__playwright-firefox__browser_evaluate, mcp__playwright-firefox__browser_run_code_unsafe, mcp__playwright-firefox__browser_click, mcp__playwright-firefox__browser_type, mcp__playwright-firefox__browser_fill_form, mcp__playwright-firefox__browser_press_key, mcp__playwright-firefox__browser_wait_for, mcp__playwright-firefox__browser_close, mcp__playwright-firefox__browser_console_messages, mcp__playwright-firefox__browser_network_requests, mcp__playwright-firefox__browser_take_screenshot, mcp__playwright-firefox__browser_resize, mcp__playwright-firefox__browser_file_upload, mcp__playwright-firefox__browser_find, mcp__playwright-webkit__browser_navigate, mcp__playwright-webkit__browser_find, mcp__playwright-webkit__browser_navigate_back, mcp__playwright-webkit__browser_snapshot, mcp__playwright-webkit__browser_evaluate, mcp__playwright-webkit__browser_run_code_unsafe, mcp__playwright-webkit__browser_click, mcp__playwright-webkit__browser_type, mcp__playwright-webkit__browser_fill_form, mcp__playwright-webkit__browser_press_key, mcp__playwright-webkit__browser_wait_for, mcp__playwright-webkit__browser_close, mcp__playwright-webkit__browser_console_messages, mcp__playwright-webkit__browser_network_requests, mcp__playwright-webkit__browser_take_screenshot, mcp__playwright-webkit__browser_resize, mcp__playwright-webkit__browser_file_upload, mcp__playwright-webkit__browser_find, mcp__playwright-ios__browser_navigate, mcp__playwright-ios__browser_find, mcp__playwright-ios__browser_navigate_back, mcp__playwright-ios__browser_snapshot, mcp__playwright-ios__browser_evaluate, mcp__playwright-ios__browser_run_code_unsafe, mcp__playwright-ios__browser_click, mcp__playwright-ios__browser_type, mcp__playwright-ios__browser_fill_form, mcp__playwright-ios__browser_press_key, mcp__playwright-ios__browser_wait_for, mcp__playwright-ios__browser_close, mcp__playwright-ios__browser_console_messages, mcp__playwright-ios__browser_network_requests, mcp__playwright-ios__browser_take_screenshot, mcp__playwright-ios__browser_resize, mcp__playwright-ios__browser_file_upload, mcp__playwright-ios__browser_find, mcp__playwright-android__browser_navigate, mcp__playwright-android__browser_find, mcp__playwright-android__browser_navigate_back, mcp__playwright-android__browser_snapshot, mcp__playwright-android__browser_evaluate, mcp__playwright-android__browser_run_code_unsafe, mcp__playwright-android__browser_click, mcp__playwright-android__browser_type, mcp__playwright-android__browser_fill_form, mcp__playwright-android__browser_press_key, mcp__playwright-android__browser_wait_for, mcp__playwright-android__browser_close, mcp__playwright-android__browser_console_messages, mcp__playwright-android__browser_network_requests, mcp__playwright-android__browser_take_screenshot, mcp__playwright-android__browser_resize, mcp__playwright-android__browser_file_upload, mcp__playwright-android__browser_find
---

# Browser compatibility testing

Run the quote journey across five browser targets via the Playwright MCP servers, capture per-target evidence screenshots, and write a compatibility report with a production-readiness recommendation.

## Session requirement

This skill needs five Playwright MCP servers. The `playwright` (Chrome) server comes from `.mcp.json`; the other four come from `.mcp-browser-compat.json`, which is **not loaded in normal sessions**. Start the session from the repo root with:

```
claude --mcp-config .mcp-browser-compat.json
```

The flag merges both config files, so all five servers are available.

## Parameters

`args` is a space-separated string: `<ticket> <url>`

- First token: Jira ticket number. Default `NRF2-1095`.
- Remainder: base URL. Default `http://localhost:3000/`.

The stack must already be up (tilt / docker compose) — never start the app. If the base URL refuses to connect, stop and tell the user to bring the stack up.

## Targets

| Target | Tool prefix | Engine | Approximates (ticket) | UA / viewport |
|---|---|---|---|---|
| `desktop-chrome` | `mcp__playwright__` | Chromium — system Chrome | Windows/macOS Chrome; ≈ Windows Edge | macOS Chrome UA (server flag) |
| `desktop-firefox` | `mcp__playwright-firefox__` | Gecko | Windows/macOS Firefox | Windows Firefox UA (server flag) |
| `desktop-webkit` | `mcp__playwright-webkit__` | WebKit | macOS Safari (engine-level) | macOS Safari UA (server flag) |
| `ios-safari` | `mcp__playwright-ios__` | WebKit + iPhone 17 device | iOS Safari (emulated) | device UA, 402×681, touch |
| `android-chrome` | `mcp__playwright-android__` | Chromium + Pixel 10 device | Android Chrome; ≈ Samsung Internet | device UA, 360×732, touch |

Run targets in this fixed order: `desktop-chrome` → `desktop-firefox` → `desktop-webkit` → `ios-safari` → `android-chrome`. One headed browser at a time — `browser_close` each target before starting the next.

## Rules (inherited from test-in-browser)

- Use **only the Playwright MCP tools** for browser interaction. If Playwright MCP tools are not available, stop immediately and report this to the user.
- MCP tools are **not available inside agent sub-calls** — do everything in the main session.
- **Black-box:** verify from the browser alone; don't read app source. If a check genuinely can't be observed in-browser, mark it "code-verified" and say what was looked up.
- Cookies are HttpOnly; all form POSTs are CSRF-protected — never POST via `fetch`.
- **Never clear cookies mid-journey** — it invalidates the CSRF token and the boundary validation endpoint returns 403.

## Pre-flight

1. **Verify all five servers' tools exist** in this session (e.g. `mcp__playwright-webkit__browser_navigate`). If any of the four browser-compat servers are missing, **stop** and tell the user: "This session doesn't have the browser-compat MCP servers. Exit and relaunch from the repo root with `claude --mcp-config .mcp-browser-compat.json`, then re-run this skill." If a server is present but fails to launch a browser with a missing-executable error, tell the user to run `npx -y -p @playwright/mcp@latest -- playwright install chromium firefox webkit` and relaunch. On Linux, WebKit additionally needs system libraries — if the WebKit servers fail with a missing-dependencies banner, the fix is `sudo apt-get install libevent-2.1-7t64 libavif16 libmanette-0.2-0`.
2. Invoke the `read-jira-ticket` skill with the ticket ID and extract the scenarios as a checklist (scenario 5 = journeys complete, scenario 6 = evidence recorded).
3. **Smoke every target**: for each server in order, `browser_navigate` to the base URL, confirm the start page loads (h1 present via `browser_evaluate`), record `navigator.userAgent`, `window.innerWidth × innerHeight` and `devicePixelRatio` for the report metadata, then `browser_close`. A target whose engine fails to launch is recorded as ⛔ BLOCKED (with the error) and skipped — continue with the rest.
4. On the persistent `playwright` (Chrome) server only, clear cookies via `browser_run_code_unsafe` (`page.context().clearCookies()`) **before** navigating to the start page. The four `--isolated` servers start with a fresh in-memory profile automatically.

## Per-target journey

Walk the happy path of `docs/user-journeys/quote.md` (read it first; base URL on line 3). Steps, each producing one numbered screenshot:

1. `01-start` — Start page. Open "View cookies" → **reject analytics cookies** → save → go back.
2. `02-planning-type` — select "Full planning permission", continue.
3. `03-housing` — "Are you developing housing units?" → Yes, continue.
4. `04-units` — enter `10` in the residential-units field (target `#housingUnits` by ID — it has no spinbutton role), continue.
5. `05-boundary-type` — select "Draw on a map", continue.
6. `06-map` — draw-boundary page (recipe below).
7. `07-email` — enter `nrfjourneytests@gmail.com` (the address the journey-test suite uses; use another only if the user asks) and record it in the report, continue.
8. `08-check-your-answers` — screenshot the CYA table, then "Confirm and submit".
9. `09-confirmation` — assert the confirmation heading and the NRL reference; **record the reference** per target in the report.

On every page, in order:

- Confirm the expected page loaded (`browser_snapshot` on first visit; `browser_evaluate` for h1/title asserts).
- Full-page screenshot: `browser_take_screenshot` with explicit `filename` (resolved against the workspace root), `fullPage: true`, `type: png`, `scale: css` → `docs/browser-compatibility-results/YYYY-MM-DD-quote/<target>/NN-<page>.png` (today's date; numbered per the list above).
- Layout checks via `browser_evaluate`: no horizontal overflow (`document.documentElement.scrollWidth <= window.innerWidth + 1`); exactly one non-empty `<h1>`; non-empty `document.title`.
- Console errors via `browser_console_messages` (errors only) — log page + message. Also note failed 4xx/5xx requests from `browser_network_requests`.

**Desktop targets only**, after the journey: `browser_resize` to 320×768 and screenshot the start page and one form page as `10-viewport-320-<page>.png` (the 400%-zoom proxy from the accessibility checklist). The mobile targets' native 402/360-px screenshots are their narrow-viewport evidence.

### Map recipe (draw-boundary)

Use the **keyboard-based drawing** technique from `screenshots/SKILL.md` and the full selector table in `check-accessibility/SKILL.md` ("Keyboard technique for the draw-boundary map") — many map buttons have zero bounding boxes and must be activated via `.evaluate(el => el.click())`, and map interactions must go through `browser_run_code_unsafe` so the full keyboard API is available. Essential sequence:

1. Wait ~2 s for the map to load.
2. `.evaluate` click Search → type "Aylsham" into the combobox → click the option matching `/^Aylsham(,|$)/i`.
3. Focus the Draw button → `Enter` → wait for the Cancel button (draw mode on).
4. Place 3 vertices: `Enter`, ~15× `ArrowRight` + `Enter`, ~15× `ArrowDown` + `Enter`. Wait for Done's `aria-disabled` to clear (add more vertices if not).
5. `.evaluate` click Done → wait for the boundary information panel.
6. `.evaluate` click "Save and continue" → `waitForURL(/\/quote\//, { waitUntil: 'commit' })` (lingering tile fetches hold the load event).
7. Before the map screenshot, wait ~10 s for tiles to render.

### Failure handling

If a step fails in a target: take an `NN-<page>-FAIL.png` screenshot, dump console + network errors, mark the step ❌ FAIL in the matrix, `browser_close` that target, and continue with the next target. One retry per failed tool call, then stop that target's journey. Never let one flaky target abort the whole run.

## Optional `full` mode

If the user passes `full` (or asks for the upload branch), additionally walk the upload journey per target: boundary type "Upload a file" → upload `journey-tests/test/fixtures/BnW_small_under_1_hectare.geojson` via `browser_file_upload` → the checking-file page auto-redirects with a fixed wait (`waitForTimeout(15000)` then read `page.url()` — see check-accessibility) → preview map (same recipe) → continue to email → CYA → confirmation. Number these `10-upload-…` onward (before the 320-px checks).

## Report

Write `docs/browser-compatibility-results/YYYY-MM-DD-quote.md` (create the folder; today's date) containing:

1. **Run metadata** — date, base URL, ticket, and per-target actual `navigator.userAgent` / viewport / DPR from the smoke test.
2. **Target × step matrix** — rows = the 9 journey steps (+ `viewport-320` for desktop targets), columns = the 5 targets; cells ✅ PASS / ❌ FAIL / ⚠️ PARTIAL / ⛔ BLOCKED, with a notes column for engine-specific observations.
3. **Console & network errors** — per target, page + message.
4. **Layout findings** — per target (overflow, heading/title anomalies, rendering differences worth a human look).
5. **NRL references** — the reference issued per target (proof the journey completed).
6. **Caveats** (fixed text, include verbatim):
   - WebKit is Safari's rendering engine, not the Safari product — ITP, fixed-positioning and input-zoom behaviours of real Safari are not covered.
   - Edge and Samsung Internet are approximated by the Chromium targets (Edge is not installed on this machine; Samsung Internet has no Playwright build).
   - iPhone 17 / Pixel 10 are emulations on desktop Linux — not real touch hardware, keyboards, networks, or mobile-OS browser quirks.
   - iOS Chrome/Firefox and Android Firefox are not emulatable here.
   - Real Windows/macOS/iOS/Android browsers remain manual or BrowserStack testing (browserstack.com is on the Squid proxy allowlist).
7. **Production-readiness recommendation** (ticket scenario 6) — verdict `READY` / `READY WITH CONDITIONS` / `NOT READY`, what automation covered, the not-covered list to clear manually/BrowserStack before release, and one-paragraph justification.
8. **Defect log** — every FAIL row as an entry with severity. Raise Jira bugs with `.ai/skills/tools/jira/create-ticket.mjs` only when the user asks. Post the report to the ticket with `node .ai/skills/tools/jira/add-comment.mjs <ticket> -f <report path>` only when the user asks.

Finish by closing all five browsers (each server's `browser_close`) and summarising the verdict to the user with the report path.
