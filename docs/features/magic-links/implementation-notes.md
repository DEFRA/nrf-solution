# Magic links — retrieve a saved quote

How a user gets back to a saved quote from an emailed magic link and continues
into the request to use journey, and how they ask for a new link when theirs has
been used or has timed out. Covers NRF2-1256 and NRF2-1257. For the visual flows
see [access-flow.md](access-flow.md).

## The link

`{frontEndBaseUrl}/request-to-use/retrieve/{reference}/{token}` — an `NRL-NNNNNN`
reference plus a 256-bit URL-safe token. Only the SHA-256 hash of the token is
stored (`quote_access_tokens.token_hash`); the raw token lives only in the email.
`buildRetrieveQuoteUrl` in the backend builds the link, and the frontend route is
`request-to-use/retrieve-quote`; the two must stay in step.

## Tokens

A token is **single-use** and lives for **24 hours**. `expires_at` defaults to
`now() + 24 hours` and redemption stamps `redeemed_at`, so a used token stays
distinguishable from a timed-out one in the database. The API reports both as
`expired`.

Issuing a token (`dbIssueQuoteAccessToken`) expires any still-live token for the
quote in the same statement, so only the latest link works. Sending the retrieve
your quote email (`sendRetrieveQuoteLink`) creates a token, whether it is the
first send or a new link requested from the link expired page.

A token row stays after it is spent (cleanup is deferred, see below). That is
what lets a spent token prove its holder once had the link: see `resend-link`.

## Backend endpoints

| Endpoint                                | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /quotes/email-quote-link`         | Body `{ reference, email }`. Matches the quote owner's email ignoring case. On a match it issues a token, sends the retrieve your quote email and records a `retrieve_quote_link` notification, returning `{ matched: true }`. Otherwise `{ matched: false }` and nothing is sent. A match where Notify rejects the send still responds `{ matched: true }` (and is logged), because an error only on a match would reveal it; the failed send is recorded without a Notify id for the retry in NRF2-1258                                                                                                |
| `POST /quotes/{reference}/redeem-token` | Body `{ token }`. Spends the token and responds `200 { accessStatus }` with `valid`, `invalid`, `expired` or `not_found`. The token is in the body so it stays out of access logs                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `POST /quotes/{reference}/resend-link`  | Body `{ token }`, a spent token (used, timed out or replaced) for this quote. On a match it issues a new token, sends the retrieve your quote email and records a `retrieve_quote_link` notification, returning `{ matched: true, email }` where `email` is the address it went to. Otherwise `{ matched: false }` and nothing is sent: an unknown reference, an unknown token, another quote's token and a token that is still live all look the same. A Notify rejection still responds `{ matched: true, email }`, as for `email-quote-link`. The token is in the body so it stays out of access logs |
| `GET /quotes/{reference}`               | A plain read of the quote, or 404. It does not check or spend a token, so the caller must only read a quote after a successful redeem                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Requiring both the reference and the email limits enumeration, but
`email-quote-link` does reveal whether a quote matched, because the user is sent
to a different page.

`resend-link` is the only place an email address is returned for a reference, and
it needs a spent token to do so. A reference alone never reveals the address,
and references are sequential, so returning it without that proof would let
anyone harvest addresses. Holding the token shows the caller once had the emailed
link. A token stays good for this for as long as its row exists.

`redeem-token` reports `not_found` for an unknown reference and `invalid` for a
real reference with a wrong token. The frontend treats both the same, as page not
found, so a user cannot tell them apart; only `expired` leads to the link expired
page. The backend is only reachable from the frontend and admin frontend with an
API key.

### Redemption is atomic

Redemption is a single `UPDATE … SET redeemed_at = now() WHERE token_hash = $1
AND quote_id = $2 AND redeemed_at IS NULL AND expires_at > now() RETURNING`
(`redeem-quote-access-token.js`). It guards on `redeemed_at` rather than the
clock so two concurrent redemptions cannot both succeed. On zero rows a
follow-up `SELECT` distinguishes `expired` (a row exists for the quote) from
`invalid` (absent or belongs to a different quote).

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

1. A malformed reference or token shows the page not found page (404) without
   calling the backend.
2. A link previewer or scanner (`isPrefetchRequest`, matched on User-Agent) gets
   an empty 200 and the token is not spent. Safari sends no `Sec-Fetch-*`
   headers, so the check uses a list of known bots rather than their absence.
3. The token is redeemed with `redeemEmailQuoteLinkToken`:
   - `expired` (used, timed out or replaced): the reference and token are saved
     in the `expiredLink` session key and the user is redirected (302) to
     `/request-to-use/link-expired`. The token is not in the redirect URL.
   - `invalid` or `not_found`: the page not found page (404). Both look the same,
     so a visitor cannot tell whether a quote exists.
4. On `valid` the quote is read with the plain `GET`, the session is reset and
   seeded (below), and the user is redirected (302) to
   `/request-to-use/review-quote-details`. The token is not in the redirect URL.

### Requesting a new link (`request-to-use/link-expired`)

`GET /request-to-use/link-expired` tells the user the link has expired. It is only
reachable straight after opening an expired link: a `pre` handler
(`requireExpiredLink`) shows the page not found page when the `expiredLink`
session key is empty, for the GET and the POST.

The "request a new link" action is a POST form with a button styled as a link
(`app-link-button`), not a GET link: a previewer or prefetching browser following
a GET link would send an email. `POST /request-to-use/link-expired`:

1. Sends the saved token to `POST /quotes/{reference}/resend-link`.
2. If the backend matches, clears `expiredLink`, saves the returned address as
   `retrieveQuote.email` and redirects (303) to the email confirmation page, which
   shows it. Using the saved token is what lets the backend return the address.
3. If it does not match, the page not found page. Any other backend error shows
   the standard error page.

The page has no back link. The user arrives from an email, so there is no
previous page in the service to go back to (the prototype links to its enter
email step).

The new link replaces the earlier one, so asking again, or opening the previous
link, ends up on the link expired page. Each spent token stays valid as proof
until its row is removed, so the same expired link can be used to ask again after
a new session starts; there is no throttling yet.

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

- Retrying a failed retrieve email (NRF2-1258).
- Throttling of the enter email and request a new link sends.

## Notify templates

| Email               | Template config                     | Personalisation                                                                                                 |
| ------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Retrieve your quote | `NOTIFY_TEMPLATE_ID_RETRIEVE_QUOTE` | `retrieveQuoteUrl`                                                                                              |
| Original quote      | `NOTIFY_TEMPLATE_ID_QUOTE`          | `requestToUseLink`, replacing `quoteAccessLink`: the template must be updated before the backend change deploys |

## Original quote email

The original quote email (`quote_results`) is separate from the retrieve your
quote email. It links to
`{frontEndBaseUrl}/request-to-use/enter-nrl-reference?nrlReference={reference}`
(`buildRequestToUseLink`) with no token, and its Notify variable is
`requestToUseLink`. The retry job re-sends it the same way. The `resend_quote_link`
email type is kept in the database constraint for when resending returns.

## Deferred

- **Scheduled cleanup** of old token rows (NRF2-814, won't-do for now). If it is
  added, a spent token stops being usable to request a new link once its row is
  gone, and that link then shows page not found.
