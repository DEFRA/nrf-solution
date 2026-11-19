# Environment-specific setup

Read the section that matches the target URL. Every use of something beyond the browser is a black-box exception: note it in the results table.

## Local (`localhost` targets)

More than the browser is available for setup and verification:

- **Docker logs:** `docker compose logs <service> --since <duration>` to confirm backend behaviour (e.g. that an email send was triggered, or that one was _not_).
- **Postgres DB:** `docker compose exec -T postgres psql -U postgres -d <db> -c "<SQL>"` to inspect or set up test state directly (e.g. expiring/exhausting a token to reach a state a user can't reach manually).
- **Notify API:** emails can be verified against the GOV.UK Notify API (real key locally, not a stub). See `journey-tests/test/support/find-notify-email.js` for how to query notifications by recipient, status, body text, and a `sentAfter` cutoff. Use this to confirm email content (subject/body) or that no email was sent.

## Deployed environments (e.g. `*.cdp-int.defra.cloud`)

### Bot filter and user agent

Deployed environments run a bot filter that suppresses page content for headless/scanner user agents. Playwright's default UA contains `HeadlessChrome`, so it gets treated as a scanner: requests return **200 with an empty page body (heading only, no content or error)** and do **not** consume a magic-link session. This silently breaks every scenario and looks like a content/render bug.

**Always set a real-browser UA before testing.** Pass `--user-agent` to the Playwright MCP server so it applies globally to every session. Add it to the server's args in `~/.claude.json` (user scope) or via `claude mcp add`:

```
--user-agent "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
```

Restart Claude Code after changing MCP server args for them to take effect.

### Signed-in scenarios

Real Defra ID sign-in works on deployed non-prod environments. Use the accounts on the [Test users (non-prod)](https://eaflood.atlassian.net/wiki/spaces/NRFDT/pages/6575620298) Confluence page (sign-in link, shared password and users are there; never copy credentials into the repo or output). Don't mark signed-in scenarios as untestable. Note the sign-in in the results table.

**Signing in:** go to the Your Defra account page, `https://your-account.pre.cui.defra.gov.uk/management/account-management/me`; it redirects to the Defra ID sign-in (`defra-account-*`). Choose "Sign in with GOV UK One Login", Continue, Sign in, enter the email, Continue, enter the password, Continue; you land back on the account page, now signed in. Do this with `mcp__playwright__browser_run_code_unsafe`. Only report a blocker after you have actually attempted the sign-in and seen what stopped you.

### Request-to-use journey

The request-to-use pages are only reachable with a real NRL reference and the emailed link. Use the tools in `.ai/skills/tools/notify/` (they read `NOTIFY_API_KEY` from the environment or `compose.override.yml` and never print it). Test emails go to `nrfjourneytests@gmail.com`.

- **Start the journey (about 10s, no browser calls):** `node .ai/skills/tools/notify/seed-request-to-use.mjs <base-url> nrfjourneytests@gmail.com` creates a quote over HTTP, requests the retrieve-quote email, reads it from Notify and prints `{"reference","retrieveUrl"}`. Open `retrieveUrl` in the browser (it is single-use, so each run needs a fresh one and the script never follows it). You land on `/request-to-use/review-quote-details`; Continue, then choose Yes on `accept-levy` to reach the next pages.
- **Reading an email:** `find-email.mjs <email> "<text>" <sentAfterISO>` prints the first matching email body (e.g. the quote email, which links to `/request-to-use/enter-nrl-reference?nrlReference=...`).
