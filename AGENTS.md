# AGENTS.md

Guidance for AI coding agents working in this meta-repo. Keep this file **distilled and compact** — it loads on every agent run. See [README.md](./README.md) for human-facing setup, ports, and troubleshooting.

## Always

- Before making code changes, read [.ai/rules/index.md](./.ai/rules/index.md) for coding standards.
- Run `nvm use` before any npm/node commands (Node >=24, `.nvmrc` checked in).

## Repo layout

Meta-repo. Service code lives in git submodules — each is an independent repo with its own CI/CD:

| Path | Repo | Stack | Role |
| --- | --- | --- | --- |
| `frontend/` | `nrf-frontend` | Hapi.js + Nunjucks | Public web frontend |
| `backend/` | `nrf-backend` | Node.js + Hapi | API backend |
| `impact-assessor/` | `nrf-impact-assessor` | Python + FastAPI | Spatial analysis API |
| `journey-tests/` | `nrf-journey-tests` | Cucumber + Playwright | Cross-service E2E |
| `admin-frontend/` | `nrf-admin-frontend` | Hapi.js + Nunjucks | Internal admin UI |

## Service comms

- All services run in Docker on the `cdp-tenant` network and reach each other by Docker service name (e.g. `http://backend:3001`).
- Outbound internet calls go through Squid (`HTTP_PROXY=http://squid:3128`) to mirror DEFRA CDP. HTTP clients must be proxy-aware: undici `ProxyAgent` (Node) or `httpx` (Python). A new external domain requires **both** `compose/squid.conf` AND a PR to `cdp-tenant-config` for each environment.
- Auth locally is stubbed by `defra-id-stub` (replaces DEFRA Identity / OIDC).
- File uploads go via `cdp-uploader`.

## Data stores

- **Postgres** — two DBs on one instance:
  - `nrf_backend` (schema `public`) — backend; migrations via **Liquibase**, run on `tilt up`.
  - `nrf_impact` (schema `nrf_reference`) — impact-assessor; migrations via **Alembic** + `load_data.py` fixtures, run on `tilt up`.
- **MongoDB** — used by frontend/backend (sessions, app state).
- **Redis** — caching / session store.
- **LocalStack** — emulates AWS S3, SQS, SNS for local dev.

## Symlinks

**Always create symlinks with relative paths** — never absolute. Absolute symlinks break for every other developer and in CI. Use `ln -s ../relative/path target` and verify with `ls -la`.

## Local dev

- `tilt up` from repo root brings the whole stack up. Hot reload watches `backend/src/`, `frontend/src/`, `impact-assessor/app/`.
- `compose.yml` + `compose/` define the Docker Compose stack.
- `create-symlinks.sh` wires sibling submodules into `journey-tests/compose.yml` — only needed for journey tests.
- `check-submodules.sh` reports if any submodule is behind its remote `main`.
- `format.sh` runs formatters for all three code services.

## Frontend architecture (`frontend/`)

Entry point: `src/index.js` → `src/server/server.js` creates the Hapi server. Routes are registered via `src/server/router.js`. Each route is a Hapi plugin in its own directory under `src/server/`.

**Configuration:** `convict` (`src/config/config.js`) with environment variable overrides. Access via `config.get('key.path')`.

### Views (Nunjucks)

- **Layout:** `src/server/common/templates/layouts/page.njk` extends `govuk/template.njk`
- **Page templates:** Located alongside their route module (e.g. `src/server/home/index.njk`), extend `layouts/page.njk`
- **Custom components:** `src/server/common/components/{name}/` with `macro.njk`, `template.njk`, and optional SCSS
- **Nunjucks path resolution:** Views are resolved relative to `src/server/` — so `h.view('home/index')` maps to `src/server/home/index.njk`
- **Filters/globals:** `src/config/nunjucks/filters/` and `src/config/nunjucks/globals/`

### Client-side assets

- **JS:** `src/client/javascripts/application.js` — bundled by Webpack
- **SCSS:** `src/client/stylesheets/application.scss` — imports GOV.UK Frontend styles
- **Built output:** `.public/` (gitignored)

## Backend architecture (`backend/`)

Entry point: `src/index.js` → `src/common/helpers/start-server.js` → `src/server.js` (`createServer()`).

Plugins registered in order: `requestLogger` → `requestTracing` → `secureContext` → `pulse` → `router`.

**Configuration:** `convict` (`src/config.js`) with environment-based values and strict validation.

**Routes:** Defined in `src/routes/`, registered via `src/plugins/router.js`. Each file exports an array of route configs.

**Proxy:** All outbound HTTP uses a forward proxy. `src/common/helpers/proxy/setup-proxy.js` configures a global `undici` ProxyAgent so `fetch()` is automatically proxy-aware.

**Testing:** Vitest (`vitest.config.js`). `mockReset: true` is set globally — do not add `vi.clearAllMocks()` or `vi.resetAllMocks()` to individual test files. Set mock return values in `beforeEach`.

**Error handling:** Use `@hapi/boom` for HTTP errors (`Boom.notFound()`, etc.).

**Module system:** ES modules (`"type": "module"`). All imports use `.js` extensions.

## Tools available to agents

- **Coding rules**: [.ai/rules/index.md](./.ai/rules/index.md).
- **Jira/Confluence scripts**: `.ai/skills/tools/{jira,confluence}/`. Require `ATLASSIAN_USER` and `ATLASSIAN_TOKEN` — see [atlassian-credentials.md](./docs/ai/atlassian-credentials.md).
- **Code-reviewer agent**: [code-reviewer.md](./.ai/agents/code-reviewer.md) — run across changed code after implementation.
- **Browser-test skill**: [test-in-browser/SKILL.md](./.ai/skills/test-in-browser/SKILL.md) — verify a feature against AC in a real browser.
- **Feature-builder agent**: [feature-builder.md](./.ai/agents/feature-builder.md) — staged cross-repo feature implementation from a Jira ticket + impl notes.
