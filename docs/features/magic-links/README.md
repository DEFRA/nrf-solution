# Magic links

How a user gets back to a saved quote from an emailed magic link and continues
into the request to use journey (NRF2-1256), and how they ask for a new link when
theirs has been used or has timed out (NRF2-1257).

| Document                                           | What it covers                                                                                                                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [implementation-notes.md](implementation-notes.md) | As-built summary: the endpoints, single-use tokens, the frontend handler, session seeding, requesting a new link, and what is not built yet. Also notes how the original quote email differs |
| [access-flow.md](access-flow.md)                   | Diagrams: requesting the email (enter email page), opening the magic link and requesting a new link                                                                                          |
