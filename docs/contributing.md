# Contributing

Guidance for raising PRs across the `nrf-solution` submodules.

## Cross-repo PR dependencies

When PRs across repos depend on each other, every PR in the group must reference **all** the others — not just upstream dependencies. This means if frontend, backend, and journey-tests all change together, each of the three PRs gets two `Depends-On` lines pointing at the other two.

Add to **each** PR description, using the **full PR URL** — never the `owner/repo#n` shorthand:

```
Depends-On: https://github.com/DEFRA/nrf-backend/pull/245
Depends-On: https://github.com/DEFRA/nrf-frontend/pull/320
```

**Rule: if merging this PR alone (without the others) would break anything, list all the others.**

Two things the `depends-on` CI action is strict about — get both wrong and the journey-tests check fails:
- **Full URL only.** The `owner/repo#n` shorthand (e.g. `DEFRA/nrf-backend#245`) is rejected with `ValueError: Invalid URL`. Always use `https://github.com/DEFRA/<repo>/pull/<n>`.
- **`Depends-On` lines go last.** Any prose after them breaks the parsing, so put the summary/bullets above and end the description with the `Depends-On` block.

Common cases:
- A frontend PR that changes the quote journey → `Depends-On` the backend PR and the journey-tests PR
- A backend PR that changes the API schema → `Depends-On` the frontend PR and the journey-tests PR
- A journey-tests PR → `Depends-On` the frontend PR and the backend PR

Because `Depends-On` is circular between repos (each PR lists the others), the PR number of the second PR isn't known when the first is created. Create the first PR with a placeholder URL, create the second, then `gh pr edit` the first with the real URL.

## Changing an API contract

When a PR changes an endpoint's response shape, status codes, parameters or headers (e.g. a backend route), find **every** caller across all submodules, not just the feature the change was made for: `grep` the endpoint path in `frontend/`, `admin-frontend/`, `journey-tests/` and `impact-assessor/`, and check test mocks (MSW handlers, fixtures) that encode the old shape.

- For each caller that breaks or silently changes behaviour, either raise a companion PR (with `Depends-On` lines) or state in the PR description why it's safe (e.g. the feature isn't user facing yet).
- A caller that keeps working by accident (e.g. a check that can no longer be true) still needs updating — dead branches and mocks of the old contract hide regressions.
- Say which repo should merge first.
- For migrations that drop or rename columns, note in the PR that the previous app version still queries them (so an app rollback needs a DB rollback) and what the `<rollback>` does not restore.

## Commits and PR titles

Use `<JIRA-KEY> - <short description>` for both, e.g. `NRF2-1186 - Enter NRL reference page`. The pre-commit hooks in the frontend and journey-tests repos run lint and tests (the frontend commit takes a while); never skip them. If a hook fails, fix the cause and make a new commit.

## PR descriptions

Keep PR descriptions short and easy to read, and don't include a "Test plan" section — features are verified against Jira acceptance criteria, not a PR checklist. The full rules are in the `write-pr-description` skill (`.ai/skills/write-pr-description/SKILL.md`), which AI agents load before raising a PR.
