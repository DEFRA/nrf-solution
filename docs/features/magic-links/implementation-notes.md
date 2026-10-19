# Magic links — retrieve a saved quote

How a user gets back to a saved quote from an emailed magic link and continues
into the request to use journey. Covers NRF2-1256, with the backend resend
endpoints from NRF2-731 and NRF2-815 at the end. For the visual flows see
[access-flow.md](access-flow.md) and [resend-flow.md](resend-flow.md).

## The link

`{frontEndBaseUrl}/request-to-use/retrieve/{reference}/{token}` — an `NRL-NNNNNN`
reference plus a 256-bit URL-safe token. Only the SHA-256 hash of the token is
stored (`quote_access_tokens.token_hash`); the raw token lives only in the email.
`buildRetrieveQuoteUrl` in the backend builds the link, and the frontend route is
`request-to-use/retrieve-quote`; the two must stay in step.

## Tokens

A token is **single-use** and lives for **24 hours**. `expires_at` is the only
state: it defaults to `now() + 24 hours` and redemption sets it to `now()`, so a
used token and a timed-out token look the same afterwards. There is no session
tracking and no record of when a token was redeemed.

Issuing a token (`dbIssueQuoteAccessToken`) expires any still-live token for the
quote in the same statement, so only the latest link works. This applies to
every kind of email that carries a token.

## Backend endpoints

| Endpoint                                | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /quotes/email-quote-link`         | Body `{ reference, email }`. Matches the quote owner's email ignoring case. On a match it issues a token, sends the retrieve your quote email and records a `retrieve_quote_link` notification, returning `{ matched: true }`. Otherwise `{ matched: false }` and nothing is sent. A match where Notify rejects the send still responds `{ matched: true }` (and is logged), because an error only on a match would reveal it; the failed send is recorded without a Notify id for the retry in NRF2-1258 |
| `POST /quotes/{reference}/redeem-token` | Body `{ token }`. Spends the token and responds `200 { accessStatus }` with `valid`, `invalid`, `expired` or `not_found`. The token is in the body so it stays out of access logs                                                                                                                                                                                                                                                                                                                         |
| `GET /quotes/{reference}`               | A plain read of the quote, or 404. It does not check or spend a token, so the caller must only read a quote after a successful redeem                                                                                                                                                                                                                                                                                                                                                                     |

Requiring both the reference and the email limits enumeration, but unlike the
resend endpoints `email-quote-link` does reveal whether a quote matched, because
the user is sent to a different page.

### Redemption is atomic

Redemption is a single `UPDATE … SET expires_at = now() WHERE token_hash = $1
AND quote_id = $2 AND expires_at > now() RETURNING` (`redeem-quote-access-token.js`).
On zero rows a follow-up `SELECT` distinguishes `expired` (a row exists for the
quote) from `invalid` (absent or belongs to a different quote).

## Email

The retrieve your quote email uses its own Notify template
(`NOTIFY_TEMPLATE_ID_RETRIEVE_QUOTE`) with one personalisation field,
`retrieveQuoteUrl`. Its `email_type` is `retrieve_quote_link`. Retrieve emails are
left out of the failed email retry job and of the quote's headline email status;
retrying a failed retrieve email is NRF2-1258.

## Frontend

### Requesting the email (enter your email address page)

The POST reads the saved NRL reference from the `retrieveQuote` session and calls
`POST /quotes/email-quote-link`.

- Match: the journey sessions are cleared, the submitted email is saved to
  `retrieveQuote` so the confirmation page can show it, and the user goes to the
  email confirmation page.
- No match: the answers are kept, the submitted email is saved so the back link
  from the dropout page re-shows it, and the user goes to the quote not matched
  page.
- Any other backend error shows the standard error page and is never treated as
  no match. A Notify rejection is not an error here: the backend still responds
  as matched, so it does not reveal the match.
- There is no rate limiting on this page yet. Because the match / no-match
  distinction is visible, scanning references and repeated sends to a confirmed
  pair need throttling; this is to be added as a separate ticket.
- The enter email page is only reachable with a saved NRL reference, so after a
  match the Back button goes to the start page.

### Opening the link (`request-to-use/retrieve-quote`)

`GET /request-to-use/retrieve/{reference}/{token}`:

1. A malformed reference or token redirects to `/request-to-use/link-expired`
   without calling the backend.
2. A link previewer or scanner (`isPrefetchRequest`, matched on User-Agent) gets
   an empty 200 and the token is not spent. Safari sends no `Sec-Fetch-*`
   headers, so the check uses a list of known bots rather than their absence.
3. The token is redeemed with `redeemEmailQuoteLinkToken`. Anything other than
   `valid` redirects to `/request-to-use/link-expired`.
4. On `valid` the quote is read with the plain `GET`, the session is reset and
   seeded (below), and the user is redirected (302) to
   `/request-to-use/review-quote-details`. The token is not in the redirect URL.

### Session seeding

`seedSessionFromQuote` clears every journey key, the `manage` answer and any
validation flash, then writes:

- `manage`: `request-to-use`, so the request to use journey is selected after
  the reset.
- `quote`, through the quote cache helper so it is validated: `planningType`,
  `housingUnits`, `email` (from `email.address`), `boundaryEntryType` (from
  `boundary.userInputType`), `boundaryFilename` and `boundaryGeojson` (parsed
  from `boundary.geoJsonWgs84`). `isHousing` is `yes` because it is not stored
  and a saved quote only exists for housing. The geojson is written in a second
  step, because changing the entry type clears it.
- `requestToUse`: `{ nrlReference }`. The quote schema has no reference field.

From here the session is the source of truth. Nothing writes edits back to the
database.

### Session lifetime

The session cache and cookie TTLs (`SESSION_CACHE_TTL`, `SESSION_COOKIE_TTL`)
default to 24 hours so the user can carry on for 24 hours without using the link
again. This applies to the whole session, including the quote journey. Check the
CDP config does not override them.

## Not built yet

- The link expired page (NRF2-1257 and NRF2-1264) and the review and amend page
  (NRF2-1259). Both redirects target these routes, so they 404 until the pages
  exist.
- Requesting a new link from the link expired page (NRF2-1257).
- Retrying a failed retrieve email (NRF2-1258).

## Resend endpoints (NRF2-815)

The backend still has two resend endpoints. The frontend pages that used them
(the old `/quote/{reference}/{token}` page and its resend routes) were removed
and will be reapplied for the new flow, so nothing in the frontend calls them
now. Resend emails still link to `/quote/{reference}/{token}`, which no longer
exists. Both return a deliberately uninformative shape so a caller cannot
enumerate quotes or emails.

### `POST /quotes/{reference}/resend-known`

Possession of a token issued for the quote — live, expired or already used —
proves ownership. The new link is emailed to the saved address and the response
carries a masked email (`ade**@example.com`). A token that does not match
responds `{ ok: true }` with no email. A Notify failure returns 502.

### `POST /quotes/{reference}/resend-unknown`

A new link is sent only when the email matches the quote owner (case-insensitive).
The response is identical whether or not it matched. Email validation is shared
with the frontend (TLDs disabled on both sides) so the two never diverge and leak
through a `400`.

## Deferred

- **Rate limiting** was built then removed across the access and resend routes
  (a product decision), except the browser-logs endpoint.
- **Scheduled cleanup** of old token rows (NRF2-814, won't-do for now).
