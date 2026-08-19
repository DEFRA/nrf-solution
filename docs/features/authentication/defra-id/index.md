# Authentication (DEFRA ID)

> **AI agents / developers:** read this before changing anything under `frontend/src/server/auth/`,
> `frontend/src/server/plugins/defra-identity.js`, or session handling. It reflects the real code.

Defra ID auth is OAuth 2.0 / OpenID Connect (Authorization Code flow) built **manually** on
top of `@hapi/bell` and `@hapi/yar`. Bell is registered as a strategy but the sign-in redirect
and code-for-token exchange are hand-rolled in the controller (to inject `serviceId` and avoid
Bell's automatic redirect). Sessions are server-side; the browser only holds an opaque session id.

## Key files

| File                                                | Responsibility                                                                                                           |
|-----------------------------------------------------| ------------------------------------------------------------------------------------------------------------------------ |
| `frontend/src/server/auth/controller.js`            | All 5 route handlers: login page, sign-in redirect, callback, sign-out, sign-out-oidc                                    |
| `frontend/src/server/auth/index.js`                 | Registers auth routes (only if `server.app.authEnabled`)                                                                 |
| `frontend/src/server/plugins/defra-identity.js`     | Registers `defra-id` (Bell) + `defra-session` (custom yar scheme); token validity + refresh logic; `createUserSession()` |
| `frontend/src/server/auth/refresh-tokens.js`        | OAuth `refresh_token` grant call                                                                                         |
| `frontend/src/server/auth/get-oidc-config.js`       | Fetches OIDC discovery doc from `defraId.wellKnownUrl`, memoised in-process (fetched once per deploy, not per sign-in)   |
| `frontend/src/server/auth/get-safe-redirect.js`     | Prevents open-redirect on post-login return                                                                              |
| `frontend/src/server/auth/redirect-to-sign-in.js`   | `onPreHandler` extension: sends signed-out GETs for protected routes to `/login`, remembering the requested path         |
| `frontend/src/server/common/helpers/session-cache/` | Yar server-side cache (Redis prod / memory local)                                                                        |
| `frontend/src/config/config.js`                     | `defraId.*` and `session.*` config                                                                                       |

## Auth strategies & route protection

Registered in `defra-identity.js`:

- **`defra-id`** — Bell OAuth strategy (registered, but the flow is driven manually).
- **`defra-session`** — custom `yar-session` scheme: reads `sessionId` from Yar, loads the
  session from cache, refreshes the token if expired, else returns `unauthenticated`.

There is **no server-wide default strategy**. Each route opts in explicitly:
`auth: 'defra-session'` (protected) or `auth: false` (public). If Bell/OIDC registration fails
at boot, `server.app.authEnabled` stays `false`, only `/login` is registered, and routes fall
back to `auth: false` (see `profile/index.js`).

The `defra-session` scheme reports unauthenticated **without** an error, so Hapi passes
signed-out requests through to the handler lifecycle with empty credentials
(`request.auth.credentials` is unset) rather than rejecting them. The `redirectToSignIn`
`onPreHandler` extension (and controller guards such as the profile page's) rely on that to
redirect to sign-in.

## Returning to the requested page after sign-in

When a signed-out user makes a GET request to a protected route (e.g. `/profile`), the
`redirectToSignIn` `onPreHandler` extension (registered by the DEFRA Identity plugin) stores the
requested path in the Yar session as `redirectTo` and redirects the user to `/login`. After a
successful sign-in, the OAuth callback (`/login/return`) redirects to that stored path, falling
back to the start page when none was captured. The value is validated as a relative path
(`getSafeRedirect`) both before it is stored and before the final redirect, to prevent open
redirects; `getSafeRedirect` itself returns the start page for anything unsafe. Only GET requests
are captured, and the `/auth/*` routes are excluded so a signed-out request for e.g.
`/auth/sign-out` is never bounced back to that URL after login.

## Routes

| Route                     | Auth            | Purpose                                                                    |
| ------------------------- | --------------- | -------------------------------------------------------------------------- |
| `GET /login`              | `false`         | Render sign-in page (`auth/login.njk`)                                     |
| `GET /auth/sign-in`       | `false`         | Build authorization URL, store CSRF `state` in Yar, 302 to Defra ID        |
| `GET /login/return`       | `false`         | OAuth callback: verify `state`, exchange `code` for tokens, create session |
| `GET /auth/sign-out`      | `defra-session` | Drop session from cache, clear Yar, 302 home                               |
| `GET /auth/sign-out-oidc` | `false`         | Defra ID logout callback; failsafe session clear                           |

## Sessions, tokens & cookies

- **Session store:** `server.app.sessionCache` (Catbox, segment `sessions`, 24h TTL). Holds the
  full `userSession`: `{ sessionId (uuid), isAuthenticated, profile, token, refreshToken, role, scope }`.
- **Yar cookie:** server-side backed (`maxCookieSize: 0`), `httpOnly`, `SameSite=Lax`. Stores only
  `sessionId`, plus transient `oauth_state` and `redirectTo`. Default 4h TTL (`session.*` config).
- **Bell cookie:** `bell-defra-id`, temporary OAuth transaction cookie.
- **Token refresh:** on every `defra-session` request the access token is decoded and time-checked
  (60s skew). If expired and `defraId.refreshTokens` is on, a `refresh_token` grant is made and the
  new tokens are persisted transparently. If refresh is off or fails, the session is dropped and the
  user is unauthenticated. See [token-refresh-flow.mermaid](./token-refresh-flow.mermaid).

## Flow diagrams

- [Sign in flow](./sign-in-flow.mermaid)
- [Token refresh flow](./token-refresh-flow.mermaid)
- [Sign out flow](./sign-out-flow.mermaid)

## Config (`defraId.*`)

`enabled`, `wellKnownUrl`, `clientId`, `clientSecret`, `redirectUrl`, `serviceId`,
`refreshTokens`, `scopes` (default `openid offline_access`). See `frontend/src/config/config.js`.

---

## Local setup

Run the frontend via `tilt up` from the `nrf-solution` meta-repo — don't run it standalone. Sign
out from the profile page: http://localhost:3010/profile.

To point at real Defra ID, copy the `frontend` auth env vars from `compose.override.template.yml`
into your `compose.override.yml` in `nrf-solution` and fill in the blanks (`DEFRA_ID_CLIENT_ID`,
`DEFRA_ID_CLIENT_SECRET`, `DEFRA_ID_SERVICE_ID`, `DEFRA_ID_SCOPES`). Get secret values from
another dev, or retrieve nrf-frontend test secrets via the
[CDP terminal](https://portal.cdp-int.defra.cloud/documentation/how-to/terminal.md#are-my-service-secrets-available-from-the-terminal-);
non-secret values are in
[cdp-app-config](https://github.com/DEFRA/cdp-app-config/blob/main/services/nrf-frontend/test/nrf-frontend.env).
Note `DEFRA_ID_SCOPES` must be `openid,offline_access,<clientId>` so the access token works
against nrf-backend.
