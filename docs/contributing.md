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

## PR descriptions

Don't include a "Test plan" section in PR descriptions — features are verified against Jira acceptance criteria, not a PR checklist.
