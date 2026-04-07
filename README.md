# nrf-solution

This is the parent repo for the Nature Restoration Fund (NRF) service. It brings
together the individual service repos as git submodules so you can:

- **Run the full stack locally** with a single command (via Tilt)
- **Run AI-assisted queries** across the entire codebase in one context
- **Run journey tests** against all services together

Each submodule is an independent repo with its own CI/CD. This repo does not
contain application code — it provides the glue to run everything together.

| Submodule          | Repo                        | Description                     |
| ------------------ | --------------------------- | ------------------------------- |
| `frontend`         | `DEFRA/nrf-frontend`        | Hapi.js web frontend            |
| `backend`          | `DEFRA/nrf-backend`         | Node.js API backend             |
| `impact-assessor`  | `DEFRA/nrf-impact-assessor` | Python/FastAPI spatial analysis  |
| `journey-tests`    | `DEFRA/nrf-journey-tests`   | Cucumber + Playwright E2E tests |

## Getting started

```sh
git clone --recurse-submodules <this-repo-url>
cd nrf-solution
./create-symlinks.sh   # required for Docker Compose paths
tilt up                # start all services
```

## Tilt

You may use [Tilt](https://tilt.dev) to assist with local development.

Tilt orchestrates all the services in this repo for local development. It starts Docker Compose infrastructure (databases, Redis, localstack) and the application services (frontend, backend, impact-assessor), with live reload on code changes.

A web UI at http://localhost:10350 shows the status of each service and its logs.

The Tilt dashboard is also useful for running manual scripts such as `npm install` by clicking the relevant item in the side-menu.

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
to see the dashboard. The frontend will be available at http://localhost:3000.

### Stop

Press `Ctrl+C` in the terminal running `tilt up`, then tear down the
containers:

```sh
tilt down
```

The dashboard also has manual trigger buttons for `npm install`, `uv sync`,
and code formatting if you need to run those without restarting.

## Scripts

### `create-symlinks.sh`

Creates symlinks so that the Docker Compose files in `journey-tests/` can find
the sibling repositories. The compose files expect `nrf-backend`, `nrf-frontend`,
and `nrf-impact-assessor` as sibling directories, but in this repo they are
submodules named `backend`, `frontend`, and `impact-assessor`. Run this once
after cloning.

```sh
./create-symlinks.sh
```

### `check-submodules.sh`

Checks whether each submodule is on the latest commit from its remote main
branch. Useful for seeing at a glance if any submodule needs updating.

```sh
./check-submodules.sh
```

To update all submodules to the latest: `git submodule update --remote --merge`
