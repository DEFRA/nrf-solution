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
| `frontend/src/server/auth/controller.js`            | All 5 route handlers: login page, sign-in redirect, callback, sign-out, sign-out callback                                |
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
| `GET /auth/sign-out`      | `defra-session` | Drop session from cache, clear Yar, 302 to Defra ID `end_session_endpoint` with `id_token_hint` |
| `GET /login/signed-out`   | `false`         | Defra ID post-logout callback: verify `state`, failsafe session clear, 302 home |

## Signing out

Signing out fully logs the user out of Defra ID (B2C), not just the local session. The
profile page's "Sign out" is a plain link to `GET /auth/sign-out`. That handler
(`signOutController`) drops the session from the cache, clears Yar, then **302-redirects the
browser to the OIDC `end_session_endpoint`** (from the discovery document) with three query
parameters:

- `id_token_hint` — the raw `idToken` from the session (needed for the provider to honour
  `post_logout_redirect_uri`).
- `post_logout_redirect_uri` — `<frontendBaseUrl>/login/signed-out`. Must be pre-registered
  with Defra Customer Identity against this app's client, otherwise the Defra IdP Hub ignores
  it and the user lands on the generic Defra sign-out page instead of returning to the app.
- `state` — a random CSRF value also stored in Yar as `signout_state`.

Defra ID signs the user out of B2C and any upstream IdPs, then redirects (GET) to
`post_logout_redirect_uri`, landing on `GET /login/signed-out` (`signOutOidcController`),
which verifies the echoed `state` against `signout_state` (a mismatch is logged but never
blocks), clears any residual session, and redirects home. See
[sign-out-flow.mermaid](./sign-out-flow.mermaid).

**Why a redirect, not a form POST:** B2C's sign-out bounces through several origins
(`*.b2clogin.com`, external IdPs) before returning. The CSP `form-action` directive is
enforced on *every* hop of a form submission, so a `<form>` POST to the `end_session_endpoint`
is blocked mid-chain. A top-level redirect is not a form submission, so `form-action` does not
apply. The trade-off is that `id_token_hint` rides in the URL (B2C supports GET sign-out; the
id token is small enough to fit comfortably).

## Sessions, tokens & cookies

- **Session store:** `server.app.sessionCache` (Catbox, segment `sessions`, 24h TTL). Holds the
  full `userSession`: `{ sessionId (uuid), isAuthenticated, profile, token, refreshToken, idToken, role, scope }`.
  `idToken` is the raw OIDC ID token, kept so it can be sent as the `id_token_hint` when signing out.
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

`enabled`, `baseUrl`, `wellKnownPath`, `clientId`, `clientSecret`, `serviceId`,
`refreshTokens`, `scopes` (default `openid offline_access`). The OIDC discovery document is
fetched from `baseUrl + wellKnownPath`. Separately, the top-level `frontendBaseUrl`
(`FRONTEND_BASE_URL`) is this frontend's own browser-facing origin, used to build the OAuth
return URL (`/login/return`) and the post sign-out redirect (`/login/signed-out`). See
`frontend/src/config/config.js`.

---

## Local setup

Run the frontend via `tilt up` from the `nrf-solution` meta-repo — don't run it standalone. Sign
out from the profile page: http://localhost:3010/profile.

Locally auth defaults to the **real Defra ID (cpdev) tenant** — the `baseUrl`/`wellKnownPath`
config defaults are used, so you only need to supply the credentials. Copy the `frontend` auth
env vars from `compose.override.template.yml` into your `compose.override.yml` in `nrf-solution`
and fill in the blanks (`DEFRA_ID_CLIENT_ID`, `DEFRA_ID_CLIENT_SECRET`, `DEFRA_ID_SERVICE_ID`,
`DEFRA_ID_SCOPES`). Get secret values from another dev, or retrieve nrf-frontend test secrets via
the
[CDP terminal](https://portal.cdp-int.defra.cloud/documentation/how-to/terminal.md#are-my-service-secrets-available-from-the-terminal-);
non-secret values are in
[cdp-app-config](https://github.com/DEFRA/cdp-app-config/blob/main/services/nrf-frontend/test/nrf-frontend.env).
Note `DEFRA_ID_SCOPES` must be `openid,offline_access,<clientId>` so the access token works
against nrf-backend.

To use the offline `defra-id-stub` instead (no secrets needed), point the `DEFRA_ID_*` env at it
in `compose.override.yml`:

```yaml
services:
  frontend:
    environment:
      DEFRA_ID_BASE_URL: http://defra-id-stub:3200
      DEFRA_ID_WELL_KNOWN_PATH: /cdp-defra-id-stub/.well-known/openid-configuration
      DEFRA_ID_CLIENT_ID: client-test
      DEFRA_ID_CLIENT_SECRET: test_value
      DEFRA_ID_SERVICE_ID: service-test
```
