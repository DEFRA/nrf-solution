# Session data

How the frontend stores what a user has entered, and how that state is kept, switched and cleared across the quote and request to use journeys. Magic link redemption is covered in [magic-links](../magic-links/README.md).

## Session keys

Each key is a top-level key in the Redis-backed `request.yar` session. Keys are not nested.

| Key            | Holds                                                                                                                                | Helper                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `manage`       | `whatWouldYouLikeToDo`: which journey the user chose. Belongs to neither journey.                                                    | `manageSession`                                                |
| `retrieveQuote`| Retrieve a quote answers: `hasNrlReference`, `nrlReference`, `email`.                                                                | `retrieveQuoteSession`                                         |
| `quote`        | Quote details. Also holds the saved quote's details in the request to use journey, so the review page and its change links share it. | `quote-session-cache`                                          |
| `requestToUse` | Answers that belong to the request to use journey itself. Today only `nrlReference`. Never reaches the backend through quote submit. | `requestToUseSession`                                          |
| `expiredLink`  | The spent magic link's `reference` and `token`, so the link expired page can request a new link without a token in a URL or form.     | `expiredLinkSession`                                           |
| `quoteFlash`   | Validation errors and submitted values, shared by every journey and merged onto whichever page loads next.                            | `form-validation-session`                                      |

The quote upload controllers also keep `boundaryFailureReason`, `boundaryGeojson`, `pendingUploadId`, `pendingUploadUrl` and `uploadRejectionReason` outside `quote`. They are cleared with the quote journey.

`manage`, `retrieveQuote`, `requestToUse` and `expiredLink` are created with `createSessionNamespace` (`common/helpers/session-namespace`), which gives `init`, `get`, `save` (merge, then validate against a closed Joi schema built by `extract` from the page's `form-validation.js`) and `clear`. `quote` keeps its own helpers and schemas.

Page and POST controllers take the session they work on as a parameter: `createPageController` accepts `getSessionData` (default: the quote session) and `createPostController` accepts `saveToSession`, which returns the merged data passed to `getNextPage`.

## Journeys

1. **Quote**: uses `manage` and `quote`.
2. **Retrieve a quote** (what would you like to do, up to the email being sent): uses `manage` and `retrieveQuote`.
3. **Request to use, from review and amend onwards**: redeeming a magic link replaces the whole session with `manage = request-to-use`, a `quote` seeded from the saved quote, and `requestToUse.nrlReference`. See `seedSessionFromQuote`.

## Lifecycle

All functions are in `common/helpers/journey-session`.

| Event                                              | What happens                                                                                                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start page POST                                    | `clearAllSessionData`: clears every journey key, `manage` and the validation flash. The user then answers what would you like to do to get a valid session.                                                    |
| What would you like to do POST, and the NRL prefill | `selectJourney`: saves `manage`, keeps the chosen journey's data (creating it empty if missing) and clears the other's. Quote clears `retrieveQuote` and `requestToUse`; request to use clears the quote data and `requestToUse`, and keeps `retrieveQuote`. Choosing quote creates `quote` so code expecting an object keeps working. |
| Do you have an NRL reference POST                  | Saving any answer other than yes clears a previously saved `nrlReference`.                                                                                                                                    |
| Email POST, quote found                            | `clearJourneySessions` (quote, `retrieveQuote`, `requestToUse`, `expiredLink`; not `manage`), then saves only the `email` so the confirmation page can show it.                                                |
| Email POST, no quote found                         | Nothing is cleared. The email is saved so the email page re-displays it from the dropout page's back link.                                                                                                    |
| Magic link redeemed                                | `seedSessionFromQuote`, after `clearAllSessionData`. A spent or expired link stores `expiredLink` instead.                                                                                                    |
| Request a new link                                 | `expiredLink` is cleared, `selectJourney` selects request to use (the user arrived from a magic link, not the what would you like to do page, and the confirmation page is guarded by that journey), then the email is saved. |

`manage` is cleared only by the start page POST, which therefore invalidates every journey at once.

## Guards

GET requests to a guarded page with an invalid session are redirected to `/manage/start-page`. Each is an `onPreHandler` extension registered in its plugin.

| Guard                                | Pages                                                                      | Valid when                                                                                                                                                                                                                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkForValidQuoteSession`          | `/quote/*` except confirmation and delete confirmation                     | `manage.whatWouldYouLikeToDo` is `quote` and `quote` is not null. It also redirects to the dropout page for an unsupported planning type or a non-housing development.                                                                                                      |
| `checkForValidRetrieveQuoteSession`  | Exactly: have NRL reference, enter NRL reference, enter email, no NRL reference, details do not match (quote not matched), and email confirmation | `manage` is `request-to-use` and `retrieveQuote` holds what the page needs. A saved email alone, which is what remains after the email is accepted, does not count (`isRetrieveQuoteEmailSent`). The enter email page also needs a saved `nrlReference`. The details do not match page needs both `nrlReference` and `email`, which is what a failed match leaves. The email confirmation page is the reverse: it is reachable only in the state after the email is accepted (`manage` is `request-to-use` and `retrieveQuote` holds only the email). Exact paths keep the rest of the request to use pages out of this guard. |
| `checkForValidReviewQuoteSession`    | Review quote details (GET and HEAD)                                        | The saved quote answers are complete and `requestToUse` is not null.                                                                                                                                                                                                        |

The email-sent state is implicit: it is "only an email is saved", defined once in `request-to-use/helpers/retrieve-quote-email-sent`. Saving any new answer on the retrieve quote journey changes what counts as email sent, so check that helper and its tests when adding one. Every `/request-to-use` GET route must be listed as reachable or unreachable in `request-to-use/after-email-sent.test.js`, which fails for an unlisted route.

`checkForAcceptedEmail` (`manage/helpers/check-for-accepted-email`), registered by the manage plugin because the guard above only covers request to use routes, redirects the what would you like to do page to the start page once the email has been accepted (`manage` is `request-to-use` and `retrieveQuote` holds only an email). Otherwise the page is unguarded, because it is where the user lands from the start page with an empty session.

**Prefill exception.** A link from the quote email to the enter NRL reference page with a valid `nrlReference` query parameter calls `selectJourney` for request to use and continues, so the user can start mid-journey. A saved reference beats the query value (`data?.nrlReference ?? query`). An absent or invalid value gets the normal check.

**Browser back and revisits.** After the email is accepted `retrieveQuote` holds only the email, so the guard redirects the retrieve quote pages to the start page, including on browser back. This relies on the global no-store header (`cache-control-headers.js`) so the browser re-requests the page.

## Known gaps

- The review page's change links are placeholders. The quote pages they will reach fail the quote guard, because `manage` holds `request-to-use` after a magic link. The edit quote journey must decide how those pages are admitted, for example by setting `manage` to `quote` on redemption or guarding them by `requestToUse.nrlReference`.
- Change mode returns to check-your-answers (hardcoded in `quote/controller-post.js` and several view models), not the review and amend page.
- `quoteFlash` is one shared key for every journey, and on a validation failure it holds the submitted values, including a rejected email, until the next GET.
