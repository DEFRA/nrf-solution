# Magic links

How a user gets back to a saved quote from an emailed magic link and continues
into the request to use journey (NRF2-1256), plus the backend resend endpoints
from NRF2-731 and NRF2-815.

| Document                                           | What it covers                                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [implementation-notes.md](implementation-notes.md) | As-built summary: the endpoints, single-use tokens, the frontend handler, session seeding, and what is not built yet |
| [access-flow.md](access-flow.md)                   | Diagrams: requesting the email (enter email page) and opening the magic link                                         |
| [resend-flow.md](resend-flow.md)                   | Diagrams: the backend resend endpoints, which have no frontend pages at the moment                                   |
