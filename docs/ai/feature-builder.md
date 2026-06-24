# Feature builder agent

Implements a product feature across NRF submodule repos, progressing through staged gates with user approval at each step.

Agent definition: [`.ai/agents/feature-builder.md`](../../.ai/agents/feature-builder.md)

## Prerequisites

`ATLASSIAN_USER` and `ATLASSIAN_TOKEN` must be set. See [atlassian-credentials.md](./atlassian-credentials.md).

## Usage

```
@"feature-builder (agent)" NRF2-358-admin-quote-list
```

The argument is the filename (without extension) of a markdown file in `docs/implementation-notes/`. The Jira ticket key is parsed from the filename prefix.

## Stages

1. **Confirm requirements** — reads the Jira ticket and implementation notes, flags gaps
2. **Prepare branches** — creates feature branches in each affected submodule
3. **Detailed implementation plan** — file-level plan per repo, stops for approval
4. **Implement with tests** — leads with acceptance tests, runs test suite per repo
5. **Browser test** — directs the user to run `/test-in-browser` from the main session
6. **Code review** — invokes the `code-reviewer` agent across all changes
7. **Pull requests** — updates implementation notes, opens PRs, posts URLs
