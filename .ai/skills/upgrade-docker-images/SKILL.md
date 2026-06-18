---
name: upgrade-docker-images
description: Check each submodule's Dockerfile for a newer base image on Docker Hub, keeping the Node version aligned with .nvmrc and package.json, then raise one PR per repo where an upgrade is available.
tools: Bash, Read
---

## What this does

Queries Docker Hub for the latest available base image tag for each submodule, validates that the Node version in the new tag satisfies the major constraint in `.nvmrc` and `engines.node` in `package.json`, updates `ARG PARENT_VERSION` (or the `FROM` line for `journey-tests`) in the Dockerfile, then opens one PR per repo where an upgrade was found.

## Target repos and their image families

| Repo | Image family | Tag format |
|---|---|---|
| `backend/` | `defradigital/node` + `defradigital/node-development` | `<defradigital-version>-node<x.y.z>` |
| `frontend/` | `defradigital/node` + `defradigital/node-development` | `<defradigital-version>-node<x.y.z>` |
| `admin-frontend/` | `defradigital/node` + `defradigital/node-development` | `<defradigital-version>-node<x.y.z>` |
| `journey-tests/` | `node` (plain Docker Hub library image) | `<x.y>-slim` |
| `impact-assessor/` | `defradigital/python` + `defradigital/python-development` | `<defradigital-version>-python<x.y.z>` |

If a `$REPO` parameter is passed, process only that repo. Otherwise process all five.

## Preconditions

1. Confirm `gh` is authenticated: `gh auth status`. If not, stop and tell the user to run `gh auth login`.
2. Confirm `curl` and `jq` are available on PATH.

## How Docker Hub tags are queried

Docker Hub's public API returns paginated tag lists. Use:

```bash
curl -s "https://hub.docker.com/v2/repositories/<namespace>/<image>/tags?page_size=100" | jq -r '.results[].name'
```

If there are more pages (`next` is non-null in the response), follow `next` until all tags are collected. In practice the relevant repos have fewer than 100 tags, so one page is usually sufficient — but always check.

### defradigital/node and defradigital/node-development

Tags follow `<defradigital-version>-node<x.y.z>` (e.g. `3.0.5-node24.14.1`). Both images are always released together under the same tag; updating `ARG PARENT_VERSION` in the Dockerfile covers both `FROM` lines.

To find the latest compatible tag:

1. Fetch all tags from `defradigital/node`.
2. Filter to tags matching the pattern `^\d+\.\d+\.\d+-node<MAJOR>\.` where `<MAJOR>` is the Node major from `.nvmrc` (strip the leading `v`).
3. Semver-sort by the node component (`node<x.y.z>`) descending. If two tags share the same node version, prefer the higher defradigital version (the leftmost component).
4. The highest result is the candidate tag.

### defradigital/python and defradigital/python-development

Same pattern, substituting `python` for `node`: `<defradigital-version>-python<x.y.z>`.

`impact-assessor/` has no `.nvmrc` or `package.json`. Read the Python major.minor from the current `ARG PARENT_VERSION` in the Dockerfile and only accept tags whose python component stays on the same major.minor (e.g. `3.14.x`). Never cross a major or minor Python boundary — Python minor versions are not guaranteed backwards-compatible.

### journey-tests (library node image)

Tags follow `<x.y>-slim` (e.g. `24.15-slim`). There is no defradigital prefix.

Fetch tags from `https://hub.docker.com/v2/repositories/library/node/tags?page_size=100`. Filter to `^24\.\d+-slim` (or the current major from `.nvmrc`), semver-sort descending, take the highest.

## Steps (per repo)

Process repos sequentially.

### 1. Identify the current base image version

For `defradigital` repos, read `ARG PARENT_VERSION` from the Dockerfile.

For `journey-tests`, read the `FROM node:<tag>` line.

### 2. Determine the allowed Node/Python major constraint

**Node repos** — read `.nvmrc` (strip leading `v`). Extract the major (e.g. `v24.14.1` → `24`, `v24` → `24`). Only accept new tags on that same major.

Also read `engines.node` from `package.json`. If it pins to a specific minor or patch (e.g. `>=24.14.1`), do not downgrade; the new tag's node version must be >= the current one.

**`impact-assessor`** — read the python component from the current `ARG PARENT_VERSION` (e.g. `python3.14.3` → major.minor `3.14`). Only accept new tags with `python3.14.x`.

### 3. Query Docker Hub for the latest compatible tag

Run the Hub API query described above. If the latest compatible tag matches the current `ARG PARENT_VERSION` / `FROM` tag exactly, **skip this repo**: note "already on latest" and move on. Do not open an empty PR.

### 4. Verify a clean starting point

```bash
cd $REPO
git fetch origin
git status -s
```

Stop and report if there are uncommitted changes (other than stray lockfile noise). Confirm the default branch: `git rev-parse --abbrev-ref origin/HEAD`.

### 5. Create a branch

```bash
git checkout <base-local>
git pull --ff-only origin <base>
git checkout -b chore/upgrade-docker-base-$(date +%Y%m%d)
```

If the branch name already exists, append `-2`, `-3`, etc.

### 6. Apply the update

**`defradigital` repos** — update `ARG PARENT_VERSION` in `Dockerfile`:

```bash
sed -i '' "s/^ARG PARENT_VERSION=.*/ARG PARENT_VERSION=<new-tag>/" Dockerfile
```

**`journey-tests`** — update the `FROM node:<tag>` line:

```bash
sed -i '' "s|FROM node:.*|FROM node:<new-tag>|" Dockerfile
```

**`admin-frontend` `.nvmrc` sync** — `admin-frontend/.nvmrc` is pinned to a specific patch (e.g. `v24.14.1`). If the new tag's node version differs from the current `.nvmrc` value, update `.nvmrc` to match. Example: new tag `3.0.6-node24.15.0` → set `.nvmrc` to `v24.15.0`. Do not update `.nvmrc` for repos that pin only to a major (`v24`) — those are intentionally loose.

### 7. Validate the change

Verify the Dockerfile parses correctly — the `ARG` line should be the only change (plus `.nvmrc` for `admin-frontend`):

```bash
git --no-pager diff
```

Confirm no unintended lines changed. There is no local build step required — Docker image correctness is validated by CI.

### 8. Commit

Stage only the changed files:

```bash
git add Dockerfile          # always
git add .nvmrc              # only if updated (admin-frontend node bump, or admin-frontend .nvmrc sync)
git commit -m "chore: upgrade Docker base image to <new-tag>"
```

**Never** bypass hooks (`--no-verify`, `--no-gpg-sign`). If a hook fails, stop and report — do not push.

### 9. Push and open the PR

```bash
git push -u origin <branch>
```

Open the PR with `gh`. Always pass `--head <branch>` explicitly — without it `gh` may resolve to the wrong branch and fail with "No commits between main and main". Do **not** add a "Test plan" section.

```bash
gh pr create --base <base> --head <branch> --title "chore: upgrade Docker base image to <new-tag>" --body "$(cat <<'EOF'
## Summary

Upgrades the Docker base image to the latest available tag compatible with the current Node/Python major constraint.

| | Before | After |
|---|---|---|
| Base image | `<old-tag>` | `<new-tag>` |
| Node/Python version | `<old-runtime-version>` | `<new-runtime-version>` |

No source changes. CI validates the image build.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 10. Return to base and move on

```bash
git checkout <base-local>
cd ..
```

## Final report

After all repos are processed:

| Repo | Result |
|---|---|
| backend | PR #123 — `3.0.4-node24.14.0` → `3.0.5-node24.15.0` |
| frontend | PR #124 — `3.0.5-node24.14.1` → `3.0.5-node24.15.0` |
| admin-frontend | already on latest |
| journey-tests | PR #125 — `node:24.15-slim` → `node:24.16-slim` |
| impact-assessor | PR #126 — `2.2.1-python3.14.3` → `2.2.2-python3.14.4` |

Include PR URLs. Call out any repo skipped (already latest or API error).

## Constraints

- **Never cross a Node major boundary.** If `.nvmrc` says `v24`, only accept `24.x.y` tags.
- **Never cross a Python major.minor boundary** for `impact-assessor`. Only accept `3.14.x` tags when the current image is `python3.14.x`.
- **Never downgrade** — the candidate tag's runtime version must be >= the current one.
- **`admin-frontend` `.nvmrc` must stay in sync** with the node version in the Docker tag when it is pinned to a patch version.
- **No source edits** — this skill only touches `Dockerfile` and (for `admin-frontend`) `.nvmrc`. It does not edit `package.json`, application code, or CI config.
- **Never bypass git hooks.**
