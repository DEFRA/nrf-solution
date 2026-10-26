---
name: write-pr-description
description: Write or edit a pull request title and description in any nrf-* repo. TRIGGER before running `gh pr create` or `gh pr edit`, and whenever asked to raise, open, draft or update a PR. Covers the title format, keeping descriptions short and easy to read, no Test plan section, and Depends-On lines for cross-repo PRs.
---

# Write a PR description

Read this before `gh pr create` or `gh pr edit` in any nrf-* repo (frontend, backend, impact-assessor, journey-tests, admin-frontend, performance-tests, nrf-solution).

## Keep it short and easy to read

The reviewer has the diff open next to the description. Give them what the diff can't: why, and what to watch for.

- Shape: one intro line (Jira link and what the PR does), 3 to 6 bullets of behaviour changes, then a short **Notes** section only if there is something a reviewer could trip over. Aim for a screenful, not a page.
- Describe behaviour and decisions, not files. Don't list changed files, functions or test names; the diff does that.
- One sentence of reasoning for any non-obvious choice. Cut anything the reviewer can see in the diff or in the ticket.
- Plain language. No filler, no emojis, no restating the acceptance criteria, no "all tests pass" or test counts.
- Mention only what a reviewer needs to know, for example:
  - a new `env:` config key that needs wiring into `compose.yml`, `compose.override.yml` or deployment config
  - merge or release order, or a half-working state if this PR lands alone
  - other callers or repos affected, and known gaps or follow-ups

## Title

`<JIRA-KEY> - <short description>`, e.g. `NRF2-1186 - Enter NRL reference page`. Use the same format for commit messages.

## Never

- Add a "Test plan" section. Features are verified against the Jira acceptance criteria, not a PR checklist.
- Put anything after the `Depends-On` lines.

## Cross-repo PRs: Depends-On

If merging this PR alone would break anything, every PR in the group lists all the others.

- Full PR URL only: `Depends-On: https://github.com/DEFRA/<repo>/pull/<n>`. The `owner/repo#n` shorthand fails the CI check with `ValueError: Invalid URL`.
- `Depends-On` lines go last. Prose after them breaks the CI parsing.
- The PR number of the second PR isn't known when the first is created: create the first with a placeholder, create the second, then `gh pr edit` the first with the real URL.

See [docs/contributing.md](../../../docs/contributing.md) for the reasoning and common cases.

## Stacked PRs

Say where the PR sits in the stack ("part 1 of 2", "on top of #544") on the first line. Describe only that layer's changes, and say so if an earlier layer alone leaves something half-working.

## Example

```
[NRF2-1302](https://eaflood.atlassian.net/browse/NRF2-1302) - part 1 of 2 in a stack.

- Continuing from the review page now recalculates the levy via the impact assessor and saves it to the session.
- Any impact assessor failure is logged and shown as the 500 page.
- The impact assessor URL and API key move to an `impactAssessor` config group; env var names are unchanged.

Notes
- The redirect target is built in the next PR, so it 404s until that merges. Release them together.
```
