# nrf-solution

This is the parent repo for the Nature Restoration Fund (NRF) service. It brings
together the individual service repos as git submodules so you can:

- **Run the full stack locally** with a single command (via Tilt)
- **Run AI-assisted queries** across the entire codebase in one context
- **Run journey tests** against all services together

Each submodule is an independent repo with its own CI/CD. This repo does not
contain application code — it provides the glue to run everything together.

| Submodule          | Repo                        | Description                      |
| ------------------ | --------------------------- | -------------------------------- |
| `frontend`         | `DEFRA/nrf-frontend`        | Hapi.js web frontend             |
| `backend`          | `DEFRA/nrf-backend`         | Node.js API backend              |
| `impact-assessor`  | `DEFRA/nrf-impact-assessor` | Python/FastAPI spatial analysis  |
| `journey-tests`    | `DEFRA/nrf-journey-tests`   | Cucumber + Playwright E2E tests  |

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Tilt](https://tilt.dev) — see [install instructions](#install)
- [nvm](https://github.com/nvm-sh/nvm) — for running `format.sh` locally (not needed to run the stack)

---

## Getting started

```sh
git clone --recurse-submodules <this-repo-url>
cd nrf-solution
tilt up
```

If you cloned without `--recurse-submodules`, initialise the submodules first:

```sh
git submodule update --init --recursive
```

---

## Tilt

### Install

```sh
curl -fsSL https://raw.githubusercontent.com/tilt-dev/tilt/master/scripts/install.sh | bash
```

For alternative installation methods see the [Tilt install docs](https://docs.tilt.dev/install.html).

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
| `nrf_impact` | impact-assessor | `nrf_reference` |

Connect with any PostgreSQL client (e.g. TablePlus) using:

- **Host**: `localhost`
- **Port**: `5432`
- **User**: `postgres`
- **Password**: `password`

### Migrations

Backend migrations are run by **Liquibase** against `nrf_backend` on every `tilt up`.

Impact-assessor migrations are run by **Alembic** against `nrf_impact`, followed
by **fixture data loading** (`load_data.py`), which populates the `nrf_reference`
schema with sample spatial data for local development.

To re-run impact-assessor migrations and reload fixture data manually:

```sh
docker compose run --rm impact-assessor-migration
```

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

To update all submodules to the latest:

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
