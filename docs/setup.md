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
cp compose.override.template.yml compose.override.yml
```

Edit `compose.override.yml` and replace the placeholder `NOTIFY_API_KEY` with your
real key from the [GOV.UK Notify dashboard](https://www.notifications.service.gov.uk).
This file is gitignored so your secrets stay local.

If you cloned without `--recurse-submodules`, initialise the submodules first:

```sh
git submodule update --init --recursive
```

### Tilt

```sh
curl -fsSL https://raw.githubusercontent.com/tilt-dev/tilt/master/scripts/install.sh | bash
```

For alternative installation methods see the [Tilt install docs](https://docs.tilt.dev/install.html).
