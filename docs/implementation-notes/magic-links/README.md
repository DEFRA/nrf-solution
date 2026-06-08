# Magic links

How a user reaches their quote details page from an emailed magic link, and how
they recover a working link when the old one no longer functions
(tickets NRF2-731 and NRF2-815).

| Document                                           | What it covers |
|----------------------------------------------------| -------------- |
| [implementation-notes.md](implementation-notes.md) | As-built summary of the access and resend implementation — the contract, atomic redemption, the two resend journeys, and anti-enumeration guarantees |
| [access-flow.md](access-flow.md)                   | Diagram: opening a magic link to seeing quote details or an error — bot detection, session cookie, token expiry, session budget, cross-quote mismatch, invalid/not-found tokens |
| [resend-flow.md](resend-flow.md)                   | Diagram: both resend paths (one-click known and email-entry unknown), including session-budget protection and anti-enumeration |
