---
name: review-nrf-code
description: Mandatory completion gate that reviews changed code against team coding standards. ALWAYS run after writing or changing any code in an nrf-* repository, before reporting the work as done — never skip it because tests pass.
run_as_subagent: true
---

## Parameters

1. **Files to review** (optional) — specific file paths to review; defaults to all files changed on the current branch vs `main`
2. **GitHub PR URL** (optional) — if provided, use `gh pr diff <url>` to get the changed files instead of git diff

## Steps

1. Read [.ai/rules/index.md](../../rules/index.md) and all files it links to, to load the project coding standards.
2. Identify files to review:
   - If a GitHub PR URL was provided, run `gh pr diff <url> --name-only` to get the changed files, and `gh pr diff <url>` to read the diff content.
   - Otherwise, if files were passed as a parameter, use those.
   - Otherwise run `git diff main...HEAD --name-only` to list all files changed on the current branch vs `main`.
   - If that returns no files, fall back to `git diff --name-only HEAD` (unstaged changes) and `git diff --name-only --cached` (staged changes), and combine the results.
   - If there are still no files, report that there is nothing to review and stop.
3. For each file, read the file and any associated test files in the same directory (`*.test.js`, `*.acceptance.test.js`).
4. Review each file against the rules loaded in step 1.
5. Output a structured report grouped by file. Within each file, group findings by severity:
   - **Blocker** — violates a project rule and must be fixed before merge
   - **Suggestion** — improvement that would be good to address but is not a rule violation

6. **Feed findings back into the rules.** Always do this, even when the findings are all Suggestions, and even if the rules loaded in step 1 already seem complete. For each finding, ask: "Would a rule in `.ai/rules/` have prevented this reaching a PR?"
   - Only capture recurring, generalisable problems. Ignore unique, one-off or edge cases, and anything specific to a single file or feature.
   - If a finding is a Suggestion or Blocker that no existing rule covers, or an existing rule is too vague/ambiguous to have prevented it, update the relevant file in `.ai/rules/` (`javascript.md`, `tests.md`, `html.md`, `styles.md`), following that file's existing style, section structure and level of detail. Add to or tighten an existing rule rather than duplicating it. Keep each rule short, imperative and checkable, with a brief example only if it removes ambiguity.
   - If a new rule file is genuinely needed, create it and link it from `.ai/rules/index.md`.
   - Do not weaken or remove existing rules, and do not add rules for findings you are unsure are real problems.
   - Make the edits directly in the working tree of the nrf-solution repo (do not commit or push) so the user can review them in the diff.

## Output format

For each file with findings:

```
### path/to/file.js

**Blockers**
- Line 42: `logger.error('message')` — first param must be an error instance, not a string

**Suggestions**
- Line 10: function `doThing` has 4 primitive params — consider using an object param
```

If a file has no findings, omit it from the report.

After the per-file findings, if any rules were updated in step 6, add a section:

```
### Rule updates
- .ai/rules/javascript.md: added "<short rule summary>" (prevents: <finding>)
```

If no rule changes were warranted, omit this section.

End with a one-line summary: total files reviewed, total blockers, total suggestions, total rules updated.

## Posting to GitHub

If a GitHub PR URL was provided, after outputting the report ask the user whether they want to post it as a comment on the PR. If they confirm, post the report using `gh pr comment <url> --body "<report>"`.

> **Note:** `gh` may only be used for `gh pr diff` (reading the PR diff) and `gh pr comment` (posting the report). Do not use any other `gh` subcommands (e.g. `gh pr create`, `gh pr merge`, `gh issue`).

## Subagent behaviour

Return only the structured findings report, the "Rule updates" section (if any) and the one-line summary to the main agent. Do not include preamble, tool call narration, or explanation of steps taken.
