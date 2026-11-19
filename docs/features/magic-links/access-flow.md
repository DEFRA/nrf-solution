# Retrieve a saved quote — flows

How a user asks for a magic link and then follows it back to their quote
(NRF2-1256).

## Requesting the email

```mermaid
flowchart TD
  begin(["User submits the enter your email address page"]) --> hasref{"Saved NRL reference in the session?"}
  hasref -- no --> startpage(["Start page"])
  hasref -- yes --> post["POST /quotes/email-quote-link with reference and email"]

  post --> err{"Backend error?"}
  err -- yes --> errorpage(["Standard error page"])
  err -- no --> match{"Quote exists AND email matches its owner, ignoring case?"}

  match -- no --> keep["Keep the answers, save the submitted email"]
  keep --> notmatched(["These details do not match our records page"])

  match -- yes --> token["Issue a 24 hour single-use token, expiring any earlier one"]
  token --> send["Send the retrieve your quote email"]
  send --> clear["Clear the journey sessions, save the submitted email"]
  clear --> confirmation(["We have sent you an email page"])
```

## Opening the magic link

```mermaid
flowchart TD
  open(["User opens /request-to-use/retrieve/REF/TOKEN"]) --> format{"Reference and token well formed?"}
  format -- no --> notfound(["Page not found (404)"])

  format -- yes --> bot{"Link previewer or scanner User-Agent?"}
  bot -- yes --> stub(["Empty response - token not spent"])

  bot -- no --> redeem["POST /quotes/REF/redeem-token"]
  redeem --> status{"accessStatus returned?"}
  status -- "invalid - token unknown or for another quote<br/>not_found - unknown reference" --> notfound
  status -- "expired - already used, over 24 hours old or superseded" --> expired(["Link expired page (offers a resend)"])
  status -- valid --> read["GET /quotes/REF"]

  read --> seed["Reset the session, select the request to use journey and seed quote and requestToUse"]
  seed --> review(["Review and amend your quote details page"])
```

> **Notify failures look like success.** If Notify rejects the send, the backend
> logs it, records the notification without a Notify id for the later retry, and
> still responds as matched, so an error cannot reveal that a quote matched.
>
> **Used and timed-out links look the same.** Redemption stamps `redeemed_at`,
> so a second use of a link, a link older than 24 hours and a link replaced by a
> newer one all end at the link expired page, which offers a resend. A bad or
> mismatched token, or an unknown reference, renders the page not found page.
>
> **Latest link wins.** Issuing a token expires any live token for the quote, so
> asking for another email makes the earlier link stop working.
