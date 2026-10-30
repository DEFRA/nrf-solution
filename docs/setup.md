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

