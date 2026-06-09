---
name: update-npm-deps
description: Run npm-check-updates across each npm sub-repo, applying only minor and patch upgrades (excluding major), and raise one PR per repo. A faster, on-demand alternative to Dependabot.
tools: Bash, Read
---

## What this does

Bumps non-major npm dependencies across the meta-repo's npm submodules and opens **one PR per repo** containing all minor + patch updates. Major upgrades are skipped because they are assumed to be breaking.

This is an on-demand complement to Dependabot — it does **not** disable Dependabot.

## Target repos

The npm submodules are:

- `frontend/` (`nrf-frontend`)
- `backend/` (`nrf-backend`)
- `admin-frontend/` (`nrf-admin-frontend`)
- `journey-tests/` (`nrf-journey-tests`)

Skip `impact-assessor/` — it is a Python (FastAPI) service with no `package.json`.

If a `$REPO` parameter is passed, process only that repo. Otherwise process all four.

## Preconditions

1. Run `node --version` and confirm Node >= 24. If a `.nvmrc` is present at repo root, the user normally runs `nvm use` first — assume the active shell is already on the right Node.
2. Confirm `ncu` (npm-check-updates) is on PATH: `which ncu`. If missing, run `npx npm-check-updates` instead of the bare `ncu` binary in the steps below.
3. Confirm `gh` is authenticated: `gh auth status`. If not, stop and tell the user to run `gh auth login`.

## Steps

For **each** target repo (`$REPO`), do the following in order. Process repos sequentially, not in parallel, so the working trees stay clean and PR output is easy to follow.

### 1. Verify a clean starting point

```
cd $REPO
git fetch origin
git status -s
```

- If the working tree has uncommitted changes (other than a stray `package-lock.json` from local `tilt`/install noise), **stop and report** — do not bump on top of unrelated edits. Ask the user how to proceed.
- Confirm the default branch: `git rev-parse --abbrev-ref origin/HEAD` (usually `origin/main`). Use that as `$BASE` below.

### 2. Create a branch off the latest base

```
git checkout $BASE_LOCAL   # the local branch tracking $BASE, usually main
git pull --ff-only origin <base>
git checkout -b chore/npm-minor-patch-$(date +%Y%m%d)
```

If a branch with that name already exists from a prior run, append `-2`, `-3`, etc.

### 3. Apply minor + patch updates only

Use `ncu` with a target that excludes major bumps:

```
ncu --target minor -u
```

`--target minor` upgrades to the latest **minor or patch** within the current major — it never crosses a major boundary, which is exactly the "exclude major" requirement.

- If `ncu` reports no upgrades, **skip this repo**: check out the base branch, delete the new branch, and note "no minor/patch updates available" for the summary. Do not open an empty PR.

Then **regenerate the lockfile from scratch** rather than letting `npm install` patch the existing one:

```
rm -rf node_modules package-lock.json
npm install
```

**Why a clean regen, not a plain `npm install`?** `ncu -u` followed by an incremental `npm install` frequently leaves the lockfile only *partially* resolved — missing or mismatched optional/platform packages (e.g. `@emnapi/*`) and stale transitive nesting. The local install still works because `node_modules` is already populated, but CI runs `npm ci`, which is strict and **fails** on any drift between `package.json` and `package-lock.json` (`npm error code EUSAGE ... can only install packages when ... in sync`). Deleting both `node_modules` and the lockfile forces npm to compute a fully-resolved tree that `npm ci` accepts. This was the single most common CI failure on the first run of this skill.

### 4. Capture what changed

```
ncu --target minor   # re-run WITHOUT -u to get the human-readable list for the PR body
git --no-pager diff --stat
```

Keep the `ncu` output — it lists each package as `name  ^old  →  ^new` and is the basis for the PR body.

### 5. Validate locally before raising the PR

Run **all three** gates below. Each catches a different class of failure seen on the first run; skipping any one of them lets a red PR through.

**5a. `npm ci` — reproduce what CI does.**

```
npm ci
```

This is the most important gate and the easiest to forget. `npm install` (step 3) tolerates lockfile drift; CI uses `npm ci`, which does not. Always run `npm ci` locally after the clean regen — if it errors with `EUSAGE ... in sync` or `Missing/Invalid ... from lock file`, the lockfile is wrong and **must** be fixed before pushing. See "Common failure modes" for the two flavours (lock-sync drift vs. a genuine transitive peer conflict).

**5b. Lint.** Check the repo's `package.json` `scripts` and run what exists:

```
npm run lint
```

If a `lint:fix` script exists and the only issue is auto-formatting, run the fix and re-stage.

**5c. Tests / build.** Run the test target:

```
npm test
```

- Some repos have no unit `test` script (e.g. `journey-tests` only has `test:e2e`, which needs the full stack). For those, the pre-commit hook's gate (often `format:check && lint`) is the local check; CI is the real gate.
- Prefer a target that exercises the **build**, not just isolated units — some conflicts (e.g. the `swagger-jsdoc`/`yaml` clash) only surface when the bundler/build path runs. If tests don't touch the build, run the build step explicitly.

**If any gate fails**, do not push. Stop, diagnose against "Common failure modes", and either fix it in-branch (preferred — these are usually fixable) or, if it's a genuine breaking change outside this skill's remit, leave the branch for inspection and report. A red PR is worse than no PR. Only commit once `npm ci`, lint, and tests all pass.

### 6. Commit

Stage `package.json` and `package-lock.json`:

```
git add package.json package-lock.json
git commit -m "chore: bump minor and patch npm dependencies"
```

A bump may legitimately *require* touching a few other files — stage those too when they are a **direct, demonstrable consequence** of the upgrade, for example:

- A `prettier` bump that changes formatting rules so an existing file (e.g. `AGENTS.md`) now fails `format:check`. Run the formatter and include the reformat. Confirm it's caused by the bump (the file passes on `origin/main` with the old prettier but fails with the new one) before blaming the bump.
- An `overrides` block added to `package.json` to resolve a transitive peer conflict (see "Common failure modes").
- A first-party dependency the source already imported but never declared (e.g. `joi`), pinned to the version the code currently resolves to.

Do **not** sweep in unrelated edits. If a file fails CI for a reason that is *not* caused by the bump, that is out of scope — leave it and report.

**Never** bypass hooks — do not pass `--no-verify`, `--no-gpg-sign`, or any skip flag to `git commit` or `git push`. If a pre-commit or commit-msg hook fails, fix the underlying issue, re-stage, and create a **new** commit rather than amending or skipping the hook.

### 7. Push and open the PR

```
git push -u origin <branch>
```

Then open the PR with `gh`, using a HEREDOC for the body. Do **not** add a "Test plan" section — this project tests features against Jira ACs, not a PR checklist.

```
gh pr create --base <base> --title "chore: bump minor and patch npm dependencies" --body "$(cat <<'EOF'
## Summary

Automated non-major npm dependency upgrade (minor + patch only; major versions excluded as likely breaking).

## Updated packages

<paste the `ncu --target minor` table here>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 8. Return to base and move on

```
git checkout <base-local>
cd ..
```

Then repeat for the next repo.

## Final report

After all repos are processed, output a concise summary table:

| Repo | Result |
| --- | --- |
| frontend | PR #123 — 8 packages (+ added `joi`, `yaml` override) |
| backend | PR #45 — 3 packages |
| admin-frontend | no minor/patch updates |
| journey-tests | tests failed — branch left for inspection |

Include the PR URLs so the user can review and merge them. Call out any repo where a gate failed and no PR was raised, and any repo where the bump required an extra fix (override, undeclared dep, reformat) so the reviewer knows to look.

## Common failure modes

These three classes account for every CI failure seen on the first run of this skill. Diagnose against this list before giving up on a repo.

### 1. Lockfile out of sync (`npm ci` EUSAGE)

**Symptom:** `npm ci` (locally or in CI) errors `npm error code EUSAGE ... can only install packages when your package.json and package-lock.json ... are in sync`, listing `Missing:` / `Invalid:` packages — often optional platform packages like `@emnapi/core`, `@emnapi/runtime`, `@emnapi/wasi-threads`.

**Cause:** `ncu -u` + incremental `npm install` left the lockfile partially resolved.

**Fix:** the clean regen in step 3 (`rm -rf node_modules package-lock.json && npm install`) prevents this. If you see it after pushing, regenerate the lockfile on the branch, commit the regenerated `package-lock.json`, and push. This was the most frequent failure and is fully avoided by always doing the clean regen + local `npm ci` (step 5a).

### 2. Transitive peer conflict (two packages need incompatible versions of a shared dep)

**Symptom:** `npm ci` reports `Invalid: <pkg>@X does not satisfy <pkg>@^Y` for a *shared transitive* dependency. Example seen: `swagger-jsdoc` hard-pins `yaml@2.0.0-1`, while a bump pulled `postcss-load-config` up to a version requiring `yaml@^2.4.2`. npm hoists one `yaml` to the top level, breaking the other consumer.

**Cause:** a legitimate bump changed the dependency graph so two packages can no longer share a single hoisted copy. Confirm it's bump-introduced: a clean `npm ci` on `origin/main` passes (npm nested the versions there); after the bump npm hoists them into conflict.

**Fix:** add a scoped `overrides` block to `package.json` that forces the layout. Pin the conflicting dep for *each* consumer so both get a compatible copy. For the `yaml` case the working fix was a top-level `yaml` devDependency at the version the modern consumer needs **plus** an override keeping the legacy consumer on its pin:

```jsonc
"overrides": {
  "swagger-jsdoc": { "yaml": "2.0.0-1" }   // keep legacy consumer nested
},
"devDependencies": {
  "yaml": "^2.4.2"                          // satisfy the modern consumer at top level
}
```

A *global* `"overrides": { "yaml": "^2.4.2" }` does **not** work here — it forces the legacy consumer onto the new version and breaks it at runtime (swagger-jsdoc fails in its `specification.js`). After any override change, regen the lockfile and re-run the **full** test suite (step 5c) to confirm the legacy consumer still works — `npm ci` passing is necessary but not sufficient.

### 3. Undeclared first-party dependency exposed by re-hoisting

**Symptom:** tests fail with `Cannot find package 'X'` for a package the source imports directly (seen: `joi` in `frontend`).

**Cause:** the source imported a package that was never declared in `package.json` and only resolved by accident of transitive hoisting. A bump changed hoisting and removed the accidental path. Confirm by checking the package is missing from `package.json` but imported in `src/` and present on `origin/main` only transitively.

**Fix:** add the package as an explicit dependency, pinned to the major the code already ran against (e.g. `joi@^17.13.3`, matching the transitively-resolved version — **not** the latest major, which would be an out-of-scope upgrade). This is a latent bug the bump merely exposed; declaring the dependency is the correct fix and belongs in the PR.

## Notes

- **Never** include major version bumps. `--target minor` guarantees this; do not switch to `--target latest`.
- This skill primarily changes `package.json` and `package-lock.json`. It may also touch a small number of other files **only** when they are a direct consequence of the bump (see step 6: a prettier-driven reformat, an `overrides` block, or an undeclared-dependency fix). It does not otherwise edit source.
- `npm ci`, lint, and tests run **locally** before each PR is raised (step 5); a repo that fails any gate gets no PR until fixed. Each repo's CI is a second gate on the PR before merge — and CI uses `npm ci`, which is why local `npm ci` matters.
- **Never** bypass git hooks (no `--no-verify` / `--no-gpg-sign`).
- If you want to also pick up updates the lockfile can resolve but `ncu` didn't surface (transitive security fixes), the user can run `npm audit fix` separately; that is out of scope here.
