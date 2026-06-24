# Upgrade Docker images skill

Checks each submodule's Dockerfile for a newer base image on Docker Hub and raises one PR per repo where an upgrade is available.

Skill definition: [`.ai/skills/upgrade-docker-images/SKILL.md`](../../.ai/skills/upgrade-docker-images/SKILL.md)

## Usage

Check all repos:

```
/upgrade-docker-images
```

Or scope to one repo:

```
/upgrade-docker-images backend
```

## What it does

Queries Docker Hub for the latest compatible base image tag per submodule, validates that the Node/Python version stays on the same major (never crosses a major boundary), updates `ARG PARENT_VERSION` in the Dockerfile (or the `FROM` line for `journey-tests`), and opens one PR per repo with an upgrade. Repos already on the latest tag are skipped.

## Prerequisites

- `gh` authenticated (`gh auth login`)
- `curl` and `jq` available on PATH
