# Quote access link — complete flow

How a user reaches their quote details page (or an error) from a magic link email.
Covers all scenarios: first view, repeat visits, bot detection, expired/invalid/replaced
tokens, and session budget exhaustion.

```mermaid
flowchart TD
  start([User opens /quote/REF/TOKEN]) --> bot{Bot or previewer user-agent?}

  bot -- yes --> stub([Dataless stub - no view consumed])

  bot -- no --> cookie{Valid quote_session cookie for this quote?}

  cookie -- yes --> read[Read token without consuming a view]
  read --> readlive{Token still live?}
  readlive -- yes --> details([Show quote details])
  readlive -- no --> knownexp([This link is no longer active - one-click resend to saved email])

  cookie -- no --> pattern{Token matches URL pattern?}
  pattern -- yes --> quotelookup{Quote exists for this REF?}

  quotelookup -- no --> notfound([Invalid quote link - no quote exists, no email form])
  quotelookup -- yes --> redeem{Atomic redeem - token matches this quote AND not expired AND under session budget?}

  redeem -- yes --> consume[Consume a view - session_count + 1]
  consume --> setcookie[Set quote_session cookie]
  setcookie --> details

  redeem -- no, nothing consumed --> tokenrow{Token row exists for this quote?}
  tokenrow -- yes, expired or exhausted --> knownexp
  tokenrow -- no, bad or mismatched token --> invalid([The link is invalid - email form to request a new link])
  pattern -- no --> invalid
```

> **Invalid token vs invalid reference:** the email form is offered only when there is a
> real quote behind the link — i.e. the *token* is bad (malformed, expired, exhausted or
> belongs to a different quote) but the reference resolves to an existing quote. In that
> case the user can recover by entering their email. When the *reference itself* matches
> no quote, there is nothing to recover, so the page is a dead-end ("Invalid quote link")
> with no email form.
>
> **Link replaced after edit:** when a user edits and resubmits their quote, the old
> token is invalidated and a new one issued. The old link follows the `time-expired`
> path (the replaced token's expiry is set to the past) and shows "This link is no
> longer active". The new email link works normally from `start`.
