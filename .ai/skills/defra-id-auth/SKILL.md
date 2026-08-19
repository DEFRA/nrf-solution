---
name: defra-id-auth
description: >
  Defra ID / OAuth 2.0 / OIDC authentication in nrf-frontend.
  TRIGGER when working on (reading, reviewing, editing, debugging, or testing) anything under
  frontend/src/server/auth/, frontend/src/server/plugins/defra-identity.js, session handling,
  or token refresh — load this before starting, reviews included, not only edits.
  Covers the manual Authorization Code flow (Bell registered but driven by hand), the defra-id
  vs defra-session strategies, route protection, the server-side session/token/cookie model,
  and automatic refresh-token renewal.
---

## Overview

Auth is OAuth 2.0 / OpenID Connect (Authorization Code flow) built **manually** on top of
`@hapi/bell` and `@hapi/yar`. Bell is registered as a strategy but the sign-in redirect and
code-for-token exchange are hand-rolled in `auth/controller.js` (to inject `serviceId` and
avoid Bell's automatic redirect). Sessions are server-side; the browser holds only an opaque
`sessionId`. Access tokens are refreshed transparently on each protected request.

## Read this first

The authoritative reference — key files, strategies, routes, session/token/cookie model, config,
and sequence diagrams (sign-in, token refresh, sign-out) — lives here:

- **[frontend/docs/auth/index.md](../../../frontend/docs/auth/index.md)** — read it in full before changing auth code.

Diagrams it links (same directory):
- `frontend/docs/auth/sign-in-flow.mermaid`
- `frontend/docs/auth/token-refresh-flow.mermaid`
- `frontend/docs/auth/sign-out-flow.mermaid`

## When working on auth

1. Read `frontend/docs/auth/index.md` and the relevant diagram.
2. Make the change in the code (`auth/controller.js`, `plugins/defra-identity.js`,
   `refresh-tokens.js`, etc.).
3. **Update `frontend/docs/auth/index.md` and the diagrams in the same PR** if you change the
   flow, routes, strategies, session shape, or refresh behaviour — the docs are the single
   source of truth for both humans and agents and must not drift.
4. Never read or commit `.env*` / secrets; access config via `convict` (`defraId.*`, `session.*`).
