---
name: manage-pull-requests
description: Raise, update and stack pull requests in any nrf-* repo. TRIGGER before running `gh pr create`, `gh pr edit` or `gh stack`, and whenever asked to raise, open, draft, update or stack a PR. Covers the title format, keeping descriptions short and easy to read, no Test plan section, Depends-On lines for cross-repo PRs, and creating stacked PRs with `gh stack`.
---

# Manage pull requests

Read this before `gh pr create`, `gh pr edit` or `gh stack` in any nrf-* repo (frontend, backend, impact-assessor, journey-tests, admin-frontend, performance-tests, nrf-solution).

Sections: PR descriptions (below), [Cross-repo PRs](#cross-repo-prs-depends-on), [Stacked PRs](#stacked-prs).

## PR descriptions

### Keep it short and easy to read

The reviewer has the diff open next to the description. Give them what the diff can't: why, and what to watch for.

- Shape, in this order:
  1. One intro line: the Jira link and what the PR does.
  2. A `## Summary` heading with 3 to 6 bullets of behaviour changes.
  3. A `## Notes` heading, only if something could trip a reviewer.
  4. An optional "Generated with…" footer line.
  5. `Depends-On` lines, last, when needed.
- Aim for a screenful, not a page.
- Describe behaviour and decisions, not files. Don't list changed files, functions or test names; the diff does that.
- One sentence of reasoning for any non-obvious choice. Cut anything the reviewer can see in the diff or in the ticket.
- Plain language. No filler, no emojis, no restating the acceptance criteria, no "all tests pass" or test counts.
- Mention only what a reviewer needs to know, for example:
  - a new `env:` config key that needs wiring into `compose.yml`, `compose.override.yml` or deployment config
  - merge or release order, or a half-working state if this PR lands alone
  - other callers or repos affected, and known gaps or follow-ups
- Before submitting, delete any line a reviewer could get from the diff or the ticket.

### Title

`<JIRA-KEY> - <short description>`, e.g. `NRF2-1186 - Enter NRL reference page`. Use the same format for commit messages.

### Never

- Add a "Test plan" section. Features are verified against the Jira acceptance criteria, not a PR checklist.
- Put anything after the `Depends-On` lines, including a "Generated with…" footer. It goes above them.

### Passing the body

Pass the body with a quoted HEREDOC so backticks and newlines survive:

```sh
gh pr create --title "NRF2-1186 - Enter NRL reference page" --body "$(cat <<'EOF'
...
EOF
)"
```

## Cross-repo PRs: Depends-On

If merging this PR alone would break anything, every PR in the group lists all the others.

- Full PR URL only: `Depends-On: https://github.com/DEFRA/<repo>/pull/<n>`. The `owner/repo#n` shorthand fails the CI check with `ValueError: Invalid URL`.
- `Depends-On` lines go last. Prose after them breaks the CI parsing.
- The PR number of the second PR isn't known when the first is created: create the first with a placeholder, create the second, then `gh pr edit` the first with the real URL.

## Stacked PRs

Use GitHub's stacked PRs via the `gh stack` extension ([quickstart](https://docs.github.com/en/pull-requests/get-started/stacked-prs-quickstart)), not `gh pr create --base <other-branch>`. Each PR targets the branch below it and reviewers see only that layer's diff. A stack lives within one repo; stacking across repos is not possible, so use `Depends-On` for those.

Needs GitHub CLI 2.90.0+, Git 2.20+ and `gh extension install github/gh-stack`.

- New stack: `gh stack init <first-branch>`, commit, then `gh stack add <next-branch>` for each layer (`gh stack add -Am "message"` stages, commits and branches in one go).
- Existing branches (including a branch whose PR is already open): `gh stack init <bottom-branch> <next-branch> ...`, listed bottom to top. Existing branches are adopted, missing ones created. Use `--base <branch>` if the bottom of the stack is not the default branch.
- Check with `gh stack view`.
- Push and create or update the PRs with `gh stack submit`. It opens an editor for titles and descriptions; `--auto` skips it with generated titles, so prefer the editor or `gh pr edit` afterwards to apply the description rules above.
- After a lower layer merges or changes, `gh stack sync` fetches, cascade-rebases, pushes and updates the PRs.

In each PR description, say where it sits in the stack ("part 1 of 2", "on top of #544") on the first line. Describe only that layer's changes, and say so if an earlier layer alone leaves something half-working.

## Examples

A single-repo PR:

```
[NRF2-1302](https://eaflood.atlassian.net/browse/NRF2-1302) - part 1 of 2 in a stack.

## Summary

- Continuing from the review page now recalculates the levy via the impact assessor and saves it to the session.
- Any impact assessor failure is logged and shown as the 500 page.
- The impact assessor URL and API key move to an `impactAssessor` config group; env var names are unchanged.

## Notes

- The redirect target is built in the next PR, so it 404s until that merges. Release them together.
```

A cross-repo PR, with the footer above the `Depends-On` lines:

```
[NRF2-1302](https://eaflood.atlassian.net/browse/NRF2-1302) - journey tests for the accept levy page.

## Summary

- Adds two scenarios covering the accept levy page.

Generated with Claude Code

Depends-On: https://github.com/DEFRA/nrf-frontend/pull/544
Depends-On: https://github.com/DEFRA/nrf-frontend/pull/545
```
