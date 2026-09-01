---
name: defra-id-auth
description: >
  Defra ID / OAuth 2.0 / OIDC authentication across the nrf-frontend and nrf-backend codebases.
  TRIGGER when working on (reading, reviewing, editing, debugging, or testing) any code that
  involves Defra ID auth — including but not limited to frontend/src/server/auth/,
  frontend/src/server/plugins/defra-identity.js, session handling, token refresh, or backend
  routes/endpoints that consume or validate Defra ID tokens or the defraId claim.
  Load this before starting, whether you are editing code or reviewing it.
  Covers the hand-rolled Authorization Code flow, the defra-session strategy, route protection,
  the server-side session/token/cookie model, and automatic refresh-token renewal.
---

## Overview

Auth is OAuth 2.0 / OpenID Connect (Authorization Code flow) built **manually** on top of
`@hapi/yar`. The sign-in redirect and code-for-token exchange are hand-rolled in
`auth/controller.js` (to inject `serviceId` and control the redirect flow). Sessions are
server-side; the browser holds only an opaque `sessionId`. Access tokens are refreshed
transparently on each protected request.

**The Defra ID `sub` claim (`defraId`) is PII** — it is a persistent identifier for an
individual. Never put it in URL paths or query strings (it would land in access logs,
proxy logs, and browser history); pass it in request bodies or headers. This applies to
backend endpoints too (e.g. `nrf-backend` `/users` routes), not just frontend auth code.

## Read this first

The authoritative reference — key files, strategies, routes, session/token/cookie model, config,
and sequence diagrams (sign-in, token refresh, sign-out) — lives here:

- **[docs/features/authentication/defra-id/index.md](../../../docs/features/authentication/defra-id/index.md)** — read it in full before changing auth code.

Diagrams it links (same directory):
- `docs/features/authentication/defra-id/sign-in-flow.mermaid`
- `docs/features/authentication/defra-id/token-refresh-flow.mermaid`
- `docs/features/authentication/defra-id/sign-out-flow.mermaid`

## When working on auth

1. Read `docs/features/authentication/defra-id/index.md` and the relevant diagram.
2. Make the change in the code (`auth/controller.js`, `plugins/defra-identity.js`,
   `refresh-tokens.js`, etc.).
3. **Update `docs/features/authentication/defra-id/index.md` and the diagrams in the same PR** if
   you change the flow, routes, strategies, session shape, or refresh behaviour — the docs are the
   single source of truth for both humans and agents and must not drift.
4. Never read or commit `.env*` / secrets; access config via `convict` (`defraId.*`, `session.*`).
