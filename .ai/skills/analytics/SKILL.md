---
name: analytics
description: >
  Architecture and conventions for Google Tag Manager analytics in nrf-frontend.
  Read before editing or reviewing any GTM dataLayer push, analytics gate condition,
  cookie consent handling, or custom event in a Nunjucks template or server-side
  JavaScript file.
---

## Overview

Analytics in nrf-frontend uses Google Tag Manager (GTM). The server renders GTM
snippets into the page HTML when the user has accepted analytics cookies. Custom
events are pushed to `window.dataLayer` — either from Nunjucks templates (for
server-driven flows like file upload) or from client-side JavaScript (for interactive
flows like the map draw tool).

---

## File map

| Concern | File |
|---|---|
| Template variables (`analyticsEnabled`, `gtmId`, `areAnalyticsCookiesAccepted`) | `frontend/src/config/nunjucks/context/context.js` |
| GTM head/body snippets, cookie-clear script, analytics-disabled banner | `frontend/src/server/common/templates/layouts/page.njk` |
| GTM head snippet partial | `frontend/src/server/common/templates/partials/google-tag-manager-head.njk` |
| GTM body snippet partial | `frontend/src/server/common/templates/partials/google-tag-manager-body.njk` |
| Upload validation custom event partial (shared by file-preview and checking-file) | `frontend/src/server/common/templates/partials/gtm-upload-result.njk` |
| Cookie consent helpers (`areAnalyticsCookiesAccepted`, `setCookiePreferences`) | `frontend/src/server/cookies/helpers/cookie-service.js` |
| Cookie route constant (`COOKIE_ROUTE`) and cookie name (`COOKIE_NAME_PREFERENCES`) | `frontend/src/server/cookies/helpers/constants.js` |
| Client-side push for the map draw flow | `frontend/src/client/javascripts/map/draw/helpers/boundary-info.js` → `pushBoundaryValidationEvent()` |

---

## Template variables

Three variables are available in every Nunjucks template via `context.js`:

- **`analyticsEnabled`** — `true` unless the request is on an internal route (`ANALYTICS_INTERNAL_ROUTE`) or `isAnalyticsDisabled` is set in config. Admin-controlled.
- **`gtmId`** — GTM container ID from config; `null` in non-production environments unless explicitly set.
- **`areAnalyticsCookiesAccepted`** — `true` when the user has accepted analytics cookies via the cookie consent banner. User-controlled.

These are distinct concepts. Do not fold `areAnalyticsCookiesAccepted` into `analyticsEnabled`
server-side: `{% if not areAnalyticsCookiesAccepted %}` is used separately to render the
GA cookie-clear script (to revoke consent when the user withdraws it).

---

## Gate condition

Every GTM-related block in a Nunjucks template must be gated on all three variables:

```njk
{% if analyticsEnabled and gtmId and areAnalyticsCookiesAccepted %}
  {# GTM scripts or dataLayer.push() here #}
{% endif %}
```

Custom event scripts additionally gate on a data condition, e.g.:

```njk
{% if analyticsEnabled and gtmId and areAnalyticsCookiesAccepted and uploadStatus %}
```

---

## Adding a new custom event to a page template

1. **Identify the event name and payload fields.** Match the naming used by the client-side
   draw flow in `boundary-info.js` if the event relates to boundary validation, so GTM
   tags can use the same trigger.

2. **Add a `<script>` block to the page template** (or a shared partial if the event appears
   on multiple pages). Gate it with the full three-variable condition. Add a `data-testid`
   attribute for test targeting:

   ```njk
   {% if analyticsEnabled and gtmId and areAnalyticsCookiesAccepted and myDataCondition %}
   <script nonce="{{ nonce }}" data-testid="gtm-my-event">
     window.dataLayer = window.dataLayer || [];
     window.dataLayer.push({
       event: 'my_event_name',
       my_field: {{ myValue | dump | safe }},
       my_optional_field: {{ optionalValue | dump | safe if optionalValue else 'undefined' }}
     });
   </script>
   {% endif %}
   ```

   Use `| dump | safe` to JSON-encode string values. Use `… if value else 'undefined'` for
   optional fields so the JS variable is literally `undefined` (not `null` or `""`).

3. **Position the block after `{{ super() }}`** if the block extends a layout block. This
   ensures the GTM init snippet (`data-testid="gtm-head"`) appears before the custom push,
   so the event lands in the data model before the Page View event fires.

4. **Pass any required data from the view model.** If the data comes from the session cache,
   use optional chaining when accessing nested properties to avoid TypeErrors on direct
   navigation or expired sessions (e.g. `quoteData.boundaryGeojson?.intersectingExcludedAreas`).

See `frontend/src/server/quote/excluded-area/index.njk` for a worked example (`rlb_intersection_areas`
event) and `frontend/src/server/common/templates/partials/gtm-upload-result.njk` for a shared
partial example (`rlb_boundary_validation` event).

---

## Testing a custom event

Every GTM event test needs three things: GTM enabled, analytics cookies accepted, and the
data condition met. Follow this pattern:

```js
import { config } from '../../../config/config.js'
import { submitForm } from '../../../test-utils/submit-form.js'
import { COOKIE_ROUTE } from '../../cookies/helpers/constants.js'
import { within } from '@testing-library/dom'

describe('GTM my-event', () => {
  const TEST_GTM_ID = 'GTM-TEST123'

  beforeEach(() => {
    config.set('gtmId', TEST_GTM_ID)
  })

  afterEach(() => {
    config.set('gtmId', null)
  })

  it('pushes the event with the expected fields', async () => {
    // 1. Prime the session (page-specific setup)
    const sessionCookie = await withValidQuoteSession(getServer(), ...)

    // 2. Accept analytics cookies — this sets cookie_preferences in the cookie jar
    const { cookie: cookiePreferences } = await submitForm({
      requestUrl: COOKIE_ROUTE,
      server: getServer(),
      formData: { analytics: 'yes', source: 'page' },
      cookie: sessionCookie
    })

    // 3. Load the page using the merged cookie
    const document = await loadPage({
      requestUrl: routePath,
      server: getServer(),
      cookie: cookiePreferences
    })

    // 4. Assert on the script content
    const { getByTestId } = within(document.documentElement)
    const script = getByTestId('gtm-my-event')
    expect(script.textContent).toContain("event: 'my_event_name'")
    expect(script.textContent).toContain('my_field: "expected_value"')
  })

  it('does not push when analytics/GTM is disabled', async () => {
    config.set('gtmId', null)
    const cookie = await withValidQuoteSession(getServer(), ...)
    const document = await loadPage({ requestUrl: routePath, server: getServer(), cookie })

    const { queryByTestId } = within(document.documentElement)
    expect(queryByTestId('gtm-my-event')).toBeNull()
  })
})
```

**Key points:**

- Name the cookie returned from the `COOKIE_ROUTE` step `cookiePreferences` — it carries
  the `cookie_preferences` cookie that satisfies the `areAnalyticsCookiesAccepted` gate.
- The "disabled" test should set `gtmId` to `null` and skip the `COOKIE_ROUTE` step — no
  need to accept cookies when GTM is off.
- To assert ordering (event fires after GTM init snippet), collect `script[data-testid]`
  elements and compare their index positions:

  ```js
  const scriptTestIds = Array.from(document.querySelectorAll('script[data-testid]'))
    .map((s) => s.getAttribute('data-testid'))
  expect(scriptTestIds.indexOf('gtm-my-event')).toBeGreaterThan(
    scriptTestIds.indexOf('gtm-head')
  )
  ```
