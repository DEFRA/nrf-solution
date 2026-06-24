# Update npm deps skill

Bumps non-major npm dependencies across all npm submodules and opens one PR per repo. A faster, on-demand alternative to Dependabot.

Skill definition: [`.ai/skills/update-npm-deps/SKILL.md`](../../.ai/skills/update-npm-deps/SKILL.md)

## Usage

Update all repos:

```
/update-npm-deps
```

Or scope to one repo:

```
/update-npm-deps frontend
```

## What it does

Runs `ncu --target minor` (minor + patch only, never major) in each npm submodule (`frontend`, `backend`, `admin-frontend`, `journey-tests`), regenerates the lockfile from scratch, validates locally with `npm ci` + lint + tests, then raises one PR per repo with updates. Repos already on the latest version are skipped.

## Prerequisites

- Node >= 24 active (`nvm use`)
- `ncu` on PATH (or falls back to `npx npm-check-updates`)
- `gh` authenticated (`gh auth login`)
