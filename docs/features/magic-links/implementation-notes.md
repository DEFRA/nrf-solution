# Magic links — quote access and resend

How a user reaches their quote details page from an emailed magic link, and how
they recover a working link when the old one no longer functions.

Covers tickets NRF2-731 (access + token validation) and NRF2-815 (resend). For
the visual flows see [access-flow.md](access-flow.md) and
[resend-flow.md](resend-flow.md).

## The link

A magic link is `/quote/{reference}/{token}` — an `NRF-NNNNNN` reference plus a
256-bit token. Only the SHA-256 hash of the token is stored
(`quote_access_tokens.token_hash`); the raw token lives only in the email link.
A `Referrer-Policy: no-referrer` header on the page stops the token leaking to
outbound links.

## Access flow (backend `GET /quotes/{reference}`)

The endpoint always responds `200 { accessStatus, quote }` — it never returns
Boom for a token/quote outcome. A malformed reference *format* is the only `400`.
`accessStatus` is one of:

| Status | Meaning | Page shown |
| ------ | ------- | ---------- |
| `valid` | Token redeemed (or read live); `quote` populated | Quote details |
| `expired` | Token row matches the quote but is past expiry or session-exhausted | "This link is no longer active" + one-click resend |
| `invalid` | No `Authorization` header, no matching token row, or token belongs to a different quote | "The link is invalid" + email-entry resend |
| `not_found` | Reference resolves to no quote | "...does not match an existing quote" — dead-end, no resend |

### Redemption is atomic

Redemption is a single `UPDATE … SET session_count = session_count + 1 …
WHERE token_hash = $1 AND quote_id = $2 AND expires_at > now() AND session_count
< max_sessions RETURNING` (`redeem-quote-access-token.js`). A view is consumed
**only** when the token matches the quote, is unexpired, and is under budget. On
zero rows a follow-up `SELECT` distinguishes `expired` (row exists) from
`invalid` (absent/mismatched).

A caller holding a valid session cookie re-reads without consuming a view
(`redeem=false` → `read-quote-access-token.js`), which also isolates
`timeExpired` from merely session-exhausted (needed by the resend rules below).

## Resend flow (NRF2-815)

Two journeys, each reached from a different error page. Both backend endpoints
return a deliberately uninformative shape so a caller cannot enumerate quotes or
emails.

### One-click resend — `POST /quotes/{reference}/resend-known`

Reached from the **"This link is no longer active"** (`expired`) page.
Possession of the token is treated as proof of ownership — the page carries the
token in a hidden field and the user just clicks **Send me a new link**.

- The token is honoured only if it is **live or time-expired**. A
  **session-exhausted** (but not time-expired) token is rejected — otherwise a
  user could reset their view budget by requesting a new link. A rejected token
  falls back to the email-entry page.
- On success the new link is emailed to the quote's **saved address**, and the
  response carries a masked email (`ade**@example.com`, first 3 local chars +
  full domain) as a memory-jog. The masked email is returned **only** on success.
- A genuine send failure (Notify rejected) returns **502** rather than a false
  confirmation.

### Email-entry resend — `POST /quotes/{reference}/resend-unknown`

Reached from the **"The link is invalid"** (`invalid`) page, and from a rejected
one-click resend. Ownership can't be proven from the token, so the user enters
the email used for the quote.

- A new link is sent **only** when the email matches the quote owner
  (case-insensitive).
- The response body is **identical** whether or not the email matched —
  `"If a matching quote is found, we've sent a new link."` — so a caller cannot
  discover whether a quote or email exists. (No timing-equalisation hash; the
  guarantee is the identical body.)
- Email Joi validation is shared with the frontend
  (`common/validation/email.js`, TLDs disabled on both sides) so the two never
  diverge and leak via a `400`.

### A new link invalidates the old one

`dbIssueQuoteAccessToken` expires any still-live token for the quote
(`UPDATE … SET expires_at = now() WHERE quote_id = $1 AND expires_at > now()`)
before inserting the new row. The previous link then follows the time-expired
path. This is also how an edited-and-resubmitted quote retires its old link.

## Frontend specifics

- Both resend POST handlers and the unknown-email validation failure follow
  **POST-Redirect-GET**: the confirmation (or inline error) is stashed in the
  session and the user is redirected to a GET confirmation route, so a refresh
  never re-triggers a resend. The invalid-token form carries a hidden `token` so
  a validation failure can redirect back to the hosting page with an inline error.
- The three error variants render from one template (`error.njk`) selected by
  `get-error-view-model.js`: `knownExpired`, `unknownExpired`, `noQuote`.
- The resend POST routes are token/email-gated, not session-gated, so they sit in
  `checkForValidQuoteSession`'s `exemptPaths`.

## Email content

The resend reuses the existing Notify `quote` template, which owns the new link,
the "valid for 7 days" statement, and the "if you didn't request this" footer.
No new template.

## Not built / deferred

- **Rate limiting** was built then removed across the access and resend routes
  (per a product decision) except the browser-logs endpoint; the associated
  "too many resends" ACs were dropped. It can be reintroduced later.
- **Scheduled cleanup** of old token rows is deferred (NRF2-814, won't-do for now).
