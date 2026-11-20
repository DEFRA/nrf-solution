# Atlassian credentials setup

Scripts under `.ai/skills/tools/jira/` and `.ai/skills/tools/confluence/` (and the agents and skills that call them — `test-in-browser`, `journey-page-builder`, etc.) require Atlassian API credentials.

Other tool folders have their own variables, covered below: `.ai/skills/tools/notify/` (`NOTIFY_API_KEY`) and `.ai/skills/tools/figma/` (`FIGMA_TOKEN`).

## Required environment variables

| Variable          | Value                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `ATLASSIAN_USER`  | Your Atlassian account email                                                                                                      |
| `ATLASSIAN_TOKEN` | API token from [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) |

Use a token created via "Create API token" (not the scoped variant) so it covers both Jira and Confluence in one go.

## Where to set them

Put the exports in `~/.zshenv` (zsh users):

```sh
# ~/.zshenv
export ATLASSIAN_USER=your.name@example.com
export ATLASSIAN_TOKEN=your-atlassian-api-token
```

`~/.zshenv` is loaded by **every** zsh invocation — interactive, non-interactive, login, subshell — so scripts run from any context will see the vars. No need to duplicate to `~/.zshrc`.

For bash users, add the same exports to `~/.bash_profile` (or `~/.bashrc` for non-login shells), or use a file that both shells source.

## Other tool credentials

### `NOTIFY_API_KEY` — GOV.UK Notify (`.ai/skills/tools/notify/`)

Used by `find-email.mjs` to look up emails the service sent via GOV.UK Notify (for example, the quote email a test triggered). Optional: if the variable is unset, the script falls back to reading the `NOTIFY_API_KEY` from your `compose.override.yml` (the backend's copy — the same single-source rule as the Tilt journey-tests button). Only if both are missing does email lookup fail.

Same value as the [GOV.UK Notify dashboard](https://www.notifications.service.gov.uk) key used in `compose.override.yml`, so normally nothing to add.

### `FIGMA_TOKEN` — Figma (`.ai/skills/tools/figma/`)

Used by `extract-journey.js` (the `util-browse-prototype` / journey-builder path for extracting page content from Figma). Required — the script exits immediately if it is unset. Create a personal access token in Figma under Settings → Account → Personal access tokens.
