# Quote link resend — flows

Two separate resend journeys, each reached from a different error page.

## One-click resend (known expired link)

Reached from the **"This link is no longer active"** page. The system still holds a
record of the token, so possession of it is treated as proof of ownership — the user
just clicks a button, no email entry needed.

The token is only honoured if it is genuinely time-expired (or still live). A
session-exhausted token is rejected so a user cannot reset their view budget by
requesting a new link; they are sent to the email-entry flow instead.

```mermaid
flowchart TD
  knownpage([This link is no longer active]) --> clickbtn[User clicks Send me a new link]
  clickbtn --> tokencheck{Backend honours token? Time-expired or still live only}

  tokencheck -- yes --> send[Email new link to the quote's saved address - no email entry needed]
  send --> sent{Email sent successfully?}
  sent -- yes --> confirm([New link sent - masked email shown e.g. ade at example.com])
  sent -- no --> err([Something went wrong - email delivery failed])

  tokencheck -- no, session-exhausted or mismatched --> fallback([Sent to the email-entry flow - see below])
```

## Email-entry resend (invalid token, real quote)

Reached from the **"The link is invalid"** page (and from a rejected one-click resend
above). The system cannot verify ownership from the token alone, so the user enters the
email address they used for the quote.

The confirmation is always identical whether or not the email matched, so a caller
cannot discover whether a quote or email address exists.

```mermaid
flowchart TD
  invalidpage([The link is invalid]) --> entermail[User enters email and clicks Send new link]
  entermail --> emailvalid{Email format valid?}

  emailvalid -- no --> valerr[Inline validation error - stay on the form]
  valerr --> entermail

  emailvalid -- yes --> matchcheck{Email matches quote owner?}
  matchcheck -- yes --> send[Issue new token and send email]
  matchcheck -- no --> nosend[No email sent]
  send --> generic([Check your email - same message shown regardless])
  nosend --> generic
```

> **Note:** a link whose NRF reference matches no quote does **not** reach either resend
> flow — it is a dead-end "Invalid quote link" page with no button or email field, because
> there is no quote to send a new link for.
