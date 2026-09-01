# Defra ID auth skill

Reference for Defra ID / OAuth 2.0 / OIDC authentication across `nrf-frontend` and `nrf-backend` — the hand-rolled Authorization Code flow, defra-session strategy, route protection, session/token/cookie model, and automatic refresh-token renewal.

Skill definition: [`.ai/skills/defra-id-auth/SKILL.md`](../../.ai/skills/defra-id-auth/SKILL.md)

## When to use

Load before working (editing, reviewing, or debugging) on any code involving Defra ID auth:

- `frontend/src/server/auth/`, `frontend/src/server/plugins/defra-identity.js`
- Session handling or token refresh
- Backend routes/endpoints that consume or validate Defra ID tokens or the `defraId` claim

## Notes

- The authoritative reference is [docs/features/authentication/defra-id/index.md](../features/authentication/defra-id/index.md) — read it in full before changing auth code
- The Defra ID `sub` claim (`defraId`) is PII: never in URL paths or query strings; pass in request bodies or headers
- If the flow, routes, session shape, or refresh behaviour change, update the docs and diagrams in the same PR
