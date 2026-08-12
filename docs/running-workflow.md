# Running and workflow

## Running

### Start

```sh
tilt up
```

This starts all services defined in the `Tiltfile`. Open http://localhost:10350
to see the Tilt dashboard.

### Stop

Press `Ctrl+C` in the terminal running `tilt up`, then tear down the containers:

```sh
tilt down
```

---

## Services

All services run inside Docker on a shared `cdp-tenant` network and communicate
directly via Docker service names. The following ports are mapped to your host:

| Service | Host port | Description |
| ---------------------- | --------- | -------------------------------------------- |
| `frontend` | 3010 | Web frontend — http://localhost:3010 |
| `backend` | 3001 | API backend |
| `impact-assessor` | 8085 | Spatial analysis API |
| `defra-id-stub` | 3200 | OIDC auth stub (replaces DEFRA Identity) |
| `cdp-uploader` | 7337 | File upload service |
| `caddy` | 4001 | Reverse proxy (upload routing) |
| `localstack` | 4566 | AWS emulation (S3, SQS, SNS) |
| `postgres` | 5432 | PostgreSQL with PostGIS |
| `redis` | 6379 | Redis |
| `mongodb` | 27017 | MongoDB |

The Tilt dashboard groups services by label:

| Label | Services |
| ------------- | ------------------------------------------------------------------ |
| `main` | `backend`, `frontend`, `impact-assessor` |
| `stubs` | `cdp-uploader`, `defra-id-stub` |
| `infra` | `localstack`, `postgres`, `redis`, `mongodb`, `caddy` |
| `migrations` | `liquibase`, `impact-assessor-migration` |
| `dev` | `format` |
| `debug` | `errors` (live stream of ERROR lines from all services) |

---

## Outbound proxy (CDP parity)

In DEFRA CDP, all outbound internet traffic from services goes through a Squid
proxy. Only domains explicitly listed in that service's ACL are allowed — everything
else is blocked. Services that bypass the proxy or call unlisted domains work
locally but fail in CDP.

To catch this class of bug locally, the stack runs its own Squid container and
sets `HTTP_PROXY=http://squid:3128` on `backend`, `frontend`, and
`impact-assessor`. All three services already use proxy-aware HTTP clients
(undici `ProxyAgent` for Node.js, httpx for Python) that automatically route
through the proxy when `HTTP_PROXY` is set.

Internal Docker service calls (e.g. frontend → impact-assessor) are routed
through Squid too — undici's `ProxyAgent` does not read `NO_PROXY`
automatically. Squid allows them via a private IP range ACL so they are not
blocked.

### Allowed domains

| Domain | Purpose | Configured in |
| --------------------------------------- | --------------------------------- | -------------- |
| `www.gov.uk` | GOV.UK content | CDP default |
| `login.microsoftonline.com` | Azure App Registrations | CDP default |
| `api.notifications.service.gov.uk` | GOV.UK Notify (email) | CDP default |
| `*.amazonaws.com` | AWS services | CDP default |
| `*.auth.eu-west-2.amazoncognito.com` | Cognito login | CDP default |
| `*.browserstack.com` | Browser Stack (tests) | CDP default |
| `api.os.uk` | Ordnance Survey map tiles | NRF-specific |

### Adding a new domain

1. Add it to `compose/squid.conf` under the `nrf_allowed` ACL.
2. Raise a PR in `cdp-tenant-config` for the relevant environment's squid JSON file — both changes must stay in sync.

### Limitation

Enforcement is **soft**: code that uses a custom HTTP client not honouring
`HTTP_PROXY` will still reach the internet locally. Such code would fail in CDP,
so it should be caught in review. The proxy catches domain-level issues for
correctly-written service code.

---

## Development workflow

### Live reload

Code changes are reflected in the running containers without a full rebuild:

| Service | Watch path | Behaviour |
| ---------------- | ------------------------- | -------------------------------- |
| `backend` | `backend/src/` | nodemon restarts |
| `frontend` | `frontend/src/` | nodemon restarts / webpack rebuilds |
| `impact-assessor` | `impact-assessor/app/` | uvicorn restarts |

Changes to `package.json` (Node services) or `pyproject.toml` (impact-assessor)
trigger a full image rebuild.

### Monitoring errors

The `errors` resource in the Tilt dashboard streams ERROR lines from all services
in one place — no need to switch between service logs. You can also filter logs
inline using the search box in each service's log pane.

---

## Databases

Two PostgreSQL databases share a single Postgres instance:

| Database | Used by | Schema |
| -------------- | ---------------------- | --------------- |
| `nrf_backend` | backend | `public` |
| `nrf_impact` | impact-assessor | `public` |

Every table in both databases is documented in
[database-schema.md](./database-schema.md), with ER diagrams. That file is
generated — see [Documenting the schema](#documenting-the-schema) below.

Connect with any PostgreSQL client (e.g. TablePlus) using:

- **Host**: `localhost`
- **Port**: `5432`
- **User**: `postgres`
- **Password**: `password`

### Migrations

Backend migrations are run by **Liquibase** against `nrf_backend` on every `tilt up`.

Impact-assessor migrations are run by **Alembic** against `nrf_impact`, followed
by **fixture data loading** (`load_data.py`), which populates the `public`
schema with sample spatial data for local development.

To re-run impact-assessor migrations and reload fixture data manually:

```sh
docker compose run --rm impact-assessor-migration
```

Impact-assessor also keeps a **parallel Liquibase changelog** in
`impact-assessor/changelog/`, applied on the deployed platform rather than
locally. `impact-assessor/scripts/check_migration_parity.py` enforces that every
Alembic revision has a matching Liquibase changeset — if you add an Alembic
revision, add the changeset too.

### Documenting the schema

[docs/database-schema.md](./database-schema.md) — every SQL table across all
repos, with ER diagrams — is **generated from the migration sources**. Do not
edit it by hand; it will be overwritten.

```sh
nvm use                              # Node >=24
node docs/db-schema/generate.js
```

No install step, no dependencies, and **no running database** — it reads the
Liquibase and Alembic sources directly, so it works with the stack down.

**When to run it.** After any migration that adds, drops or alters a table or
column — in `backend/changelog/`, `impact-assessor/alembic/versions/` or
`impact-assessor/changelog/`. Commit the regenerated file with the migration.

**What it prints.** On success, the table and database counts. It also warns
about anything it found that needs a human:

```
Wrote docs/database-schema.md — 19 tables across 2 databases, from 3 migration sources.
  ! stale diagram: backend/docs/quote-database-diagram.md — `quotes` lists dropped columns: ...
```

| Message | Meaning |
| --- | --- |
| `! stale diagram: <file>` | another hand-maintained ER diagram no longer matches the schema |
| `! <db>: ... disagree` | two definitions of one database differ, or migrations differ from the SQLAlchemy models |
| `? unrecognised source` | a migration tool was found that the generator cannot read |

**If it refuses to run.** Exit code 2 means it hit a change it does not
understand, and it names the changeset:

```
Cannot generate: the migration sources contain changes this script does not understand.

  - backend/changelog: unhandled change type <addPrimaryKey> (db.changelog-2.7.xml changeset 23)

Teach docs/db-schema/lib/ to read them rather than publishing an incomplete schema.
```

This is deliberate — publishing a plausible-looking but incomplete schema is the
failure the generator exists to prevent. Teach `docs/db-schema/lib/` to read the
new construct rather than working around it. See
[docs/db-schema/README.md](./db-schema/README.md).

**Checking without writing.** `--check` exits 1 if the committed file is out of
date, and changes nothing:

```sh
node docs/db-schema/generate.js --check
```

CI runs this on every PR that moves the `backend` or `impact-assessor` pointers.

**It documents the schema at the submodule commits this repo records**, not at
the submodules' `main` branches. Those pointers are what this repo declares the
services to be, and what a fresh checkout gets — so the document changes when a
pointer is bumped, not when a migration merges upstream.

That matters if your submodule checkouts are ahead of the recorded pointers,
which is common. Generating from there produces a document for a schema that is
not yet pinned, and CI will reject it. The generator warns when it detects this:

```
Warning: these submodules are checked out ahead of the commit this repo records:
  - backend (working tree at 1a0f13e3d09c)
```

Either `git submodule update --init` to match the pointers, or bump the pointers
first — then regenerate.

---

## Scripts

### `create-symlinks.sh`

Creates symlinks so that `journey-tests/compose.yml` can find the sibling
repositories as `nrf-backend`, `nrf-frontend`, and `nrf-impact-assessor`.
Only needed if you are running journey tests — not required for `tilt up`.

```sh
./create-symlinks.sh
```

### `check-submodules.sh`

Checks whether each submodule is on the latest commit from its remote main
branch. Useful for seeing at a glance if any submodule needs updating.

```sh
./check-submodules.sh
```

To switch all submodules to main branch and pull latest:

```sh
./update-submodules.sh
```

To update all submodules to the latest, on their current branches:

```sh
git submodule update --remote --merge
```

### `format.sh`

Runs code formatters for all three services (frontend, backend, impact-assessor).
Requires `nvm` and `uv` to be installed on the host.

```sh
./format.sh
```

This is also available as a manual trigger in the Tilt dashboard under the `dev` label.

---

## Resetting state

Named Docker volumes persist across `tilt down` so databases and LocalStack retain
data between sessions. To start completely fresh:

```sh
tilt down -v   # stops containers and removes all named volumes
tilt up        # migrations and fixture data reload automatically
```

To remove a single volume instead:

```sh
docker volume rm nrf-solution_postgres-data
docker volume rm nrf-solution_mongodb-data
docker volume rm nrf-solution_localstack-data
```

---

## Standalone development

Each service can be run independently using its own `compose.yml`:

```sh
cd backend && docker compose up
cd frontend && docker compose up
cd impact-assessor && docker compose up
```

These use their own isolated infrastructure (separate LocalStack, Postgres, Redis
instances on different ports) and do not interfere with the root stack.
