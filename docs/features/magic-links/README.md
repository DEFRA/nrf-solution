# Magic links

How a user gets back to a saved quote from an emailed magic link and continues
into the request to use journey (NRF2-1256). Only the initial send of the
retrieve your quote email is supported; sending a new link when one is invalid
or expired comes later.

| Document                                           | What it covers                                                                                                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [implementation-notes.md](implementation-notes.md) | As-built summary: the endpoints, single-use tokens, the frontend handler, session seeding, and what is not built yet. Also notes how the original quote email differs |
| [access-flow.md](access-flow.md)                   | Diagrams: requesting the email (enter email page) and opening the magic link                                                                                          |
