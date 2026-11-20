# Cookies and analytics gating

How nrf-frontend decides whether to show the cookie banner, and whether Google
Tag Manager (GTM) is allowed to load. Three independent switches are involved —
the user's cookie consent, the admin analytics opt-out, and the configured GTM
container ID.

## The `cookie_policy` cookie

Consent is stored in a single `cookie_policy` cookie (JSON, set for a year by
the cookie banner / `/cookies` page):

```json
{
  "essential": true,
  "analytics": true,
  "version": 1,
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

`version` is `COOKIE_POLICY_VERSION` (`frontend/src/server/cookies/helpers/version.js`).
When the policy changes, bump the version — existing consent is then treated as
stale (below).

`getCookiePreferences` (`frontend/src/server/cookies/helpers/cookie-service.js`)
parses and validates the cookie (Joi) and returns safe defaults (`analytics:
null`) when it is missing, malformed, fails validation, or carries an old
version. `areAnalyticsCookiesAccepted(request)` is the one-liner consumers use:
`preferences.analytics === true`.

## Policy-version staleness

`plugins/cookies.js` (`onPreResponse`) compares the stored version against the
current `COOKIE_POLICY_VERSION` on every rendered view. When they differ it
calls `clearCookiePreferences(response)` — the stale cookie is unset, so
`analytics` reads as `null`, and the cookie banner is shown again to re-ask
consent under the new policy. The same extension injects the banner state into
every view context (`showCookieBanner`, `cookiePolicy`, `currentUrl`).

## `analyticsEnabled` — the admin opt-out

`context.js` sets `analyticsEnabled` to `false` for a request when either:

- the path is `/analytics-internal` (`ANALYTICS_INTERNAL_ROUTE`), or
- the request carries the `disable_analytics_audit` cookie (set to `1`, session
  cookie — `isAnalyticsDisabled`).

`/analytics-internal` (`frontend/src/server/analytics-internal/`) is an
internal, unauthenticated page that sets or clears that cookie, letting staff
opt a browser out of analytics and audit events.

## The GTM gate

`layouts/page.njk` renders the GTM head/body snippets only when **all three**
hold:

```njk
{% if analyticsEnabled and gtmId and areAnalyticsCookiesAccepted %}
```

- `analyticsEnabled` — admin opt-out, above
- `gtmId` — from config (`GTM_ID`); null unless configured
- `areAnalyticsCookiesAccepted` — user consent, above

Conversely, `{% if not areAnalyticsCookiesAccepted %}` renders the GA
cookie-clear script (`partials/google-analytics-cookie-clear.njk`), which wipes
any previously-set Google Analytics cookies so withdrawal of consent takes
effect. When `analyticsEnabled` is false, the analytics-disabled banner partial
is rendered instead.

Do not fold the three conditions into one server-side flag — consent withdrawal
(the cookie-clear script) and the admin opt-out are handled separately by design.

Custom `dataLayer` events follow the same gate plus their own data condition;
conventions for those are in the `analytics` skill
(`.ai/skills/analytics/SKILL.md`) — read it before adding any GTM event.
