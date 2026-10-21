---
name: frontend-session-data
description: >
  Use this skill when reading, reviewing, editing or debugging how nrf-frontend stores and clears user
  answers in the session across the quote and request to use journeys: request.yar, journey-session/,
  session-namespace/, manage-session, retrieve-quote-session, request-to-use-session,
  expired-link-session, quote-session-cache, form-validation-session, the checkForValid*Session guards,
  selectJourney, clearJourneySessions, clearAllSessionData, seedSessionFromQuote — or any page/POST
  controller that reads or saves session data. Read it before opening these files, even for
  trivial-looking changes. Not for backend or admin-frontend session code.
---

# Frontend session data

Read [docs/features/session-data/README.md](../../../docs/features/session-data/README.md) before changing session-handling code. It covers the session keys, the journeys, when each key is created and cleared, and the guards.

If your change alters a session key, what clears it, or a guard's rules, update that document in the same change.
