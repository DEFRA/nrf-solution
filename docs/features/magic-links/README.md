# Magic links

How a user gets back to a saved quote from an emailed magic link and continues
into the request to use journey (NRF2-1256), including asking for a new link
from the link expired page (NRF2-1257).

| Document                                           | What it covers                                                                                                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [implementation-notes.md](implementation-notes.md) | As-built summary: the endpoints, single-use tokens, the frontend handler, session seeding and the resend flow. Also notes how the original quote email differs |
| [access-flow.md](access-flow.md)                   | Diagrams: requesting the email (enter email page) and opening the magic link                                                                                          |
