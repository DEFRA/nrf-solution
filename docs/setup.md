# Setup

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
```

If you cloned without `--recurse-submodules`, initialise the submodules first:

```sh
git submodule update --init --recursive
```

### Tilt

```sh
curl -fsSL https://raw.githubusercontent.com/tilt-dev/tilt/master/scripts/install.sh | bash
```

For alternative installation methods see the [Tilt install docs](https://docs.tilt.dev/install.html).

### Secrets / env vars
Env vars for all services should be in a file in nrf-solution repo root called compose.override.yml. If you don't have this yet, take a copy of compose.override.template.yml:

```sh
cp compose.override.template.yml compose.override.yml
```

This file is gitignored so your secrets stay local. Also Claude and agents are instructed not to read it.

#### Secrets that need adding
Edit `compose.override.yml` and set the following:
* `NOTIFY_API_KEY` use the real key from the [GOV.UK Notify dashboard](https://www.notifications.service.gov.uk).
* `DEFRA_ID_CLIENT_SECRET` for defra ID pre-prod environment - obtain from another team member
* `DEFRA_ID_BASE_URL` — the template ships a placeholder host (`your-account.pre.cui.defra.gov.uk`); replace it with the real pre-prod tenant host (same source as the client secret)

#### Values the template pre-fills or stubs
These are already in the template with placeholder or default values. The stack runs without touching them, but the feature each one drives is silently degraded until you set a real value:

| Variable | Placeholder | Without a real value |
| --- | --- | --- |
| `OS_API_KEY` (frontend) | `key` | OS Vector Tile base-map requests fail authentication — get a key from [OS Data Hub](https://osdatahub.os.uk/) |
| `GTM_ID` (frontend) | `gtm_id` | The GTM snippets load with a bogus container ID and record nothing — set the real container ID to see analytics locally |
| `AERIAL_PROXY_BASE_URL` (impact-assessor) | empty | Aerial basemap WMTS layer is missing |
| `AERIAL_PROXY_WMS_BASE_URL` (impact-assessor) | empty | Aerial basemap WMS layer (high zooms) is missing |

`DEFRA_ID_USER_PASSWORD` (frontend) is pre-filled with the shared password for all non-prod test accounts — no change needed ([list of test accounts](https://eaflood.atlassian.net/wiki/spaces/NRFDT/pages/6575620298)).

### The `overrides/` folder (OSTN15 grid)
The template bind-mounts `overrides/proj/uk_os_OSTN15_NTv2_OSGBtoETRS.tif` into the `postgres` container. The file is checked into the repo, so a normal clone already has it. It gives postgres's PROJ 7.2.1 the OSTN15 grid: without it PROJ falls back to a Helmert transform for EPSG:27700 and the EDP / exclusion map tiles land ~3 m off where `/check-boundary` (pyproj, OSTN15) puts the same points.

If the file is ever missing, re-copy it from pyproj's bundled PROJ data in the running `impact-assessor` container:

```sh
mkdir -p overrides/proj
docker compose exec -T impact-assessor sh -c \
  'cat "$(python -c "import pyproj; print(pyproj.datadir.get_data_dir())")/uk_os_OSTN15_NTv2_OSGBtoETRS.tif"' \
  > overrides/proj/uk_os_OSTN15_NTv2_OSGBtoETRS.tif
```

Deleting the file instead breaks the mount (Docker turns the missing host path into an empty directory), so `tilt up` fails until the file is restored.

