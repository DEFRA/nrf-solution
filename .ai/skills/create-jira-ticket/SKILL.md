---
name: create-jira-ticket
description: Create a new Jira ticket in the NRF2 project. Use whenever a skill or task needs to create a Jira story or sub-task.
---

## Parameters

`args` is a space-separated string of options passed directly to the create script. All options are optional except `--summary`.

| Option | Description | Default |
|---|---|---|
| `-s, --summary TEXT` | Ticket summary (required) | — |
| `-d, --description TEXT` | Description body; use `-` to read from stdin | — |
| `-t, --type TYPE` | Issue type | `Story` |
| `-P, --priority LEVEL` | `Lowest`, `Low`, `Medium`, `High`, `Highest` | — |
| `-l, --labels LABELS` | Comma-separated labels | — |
| `--parent KEY` | Parent issue key, e.g. `NRF2-100` | — |

Description text must use **Jira wiki markup** — not HTML or plain text. Key syntax:

| Markup | Renders as |
|---|---|
| `*text*` | **bold** |
| `[+label+\|url]` | underlined link |
| `h2. Heading` | section heading |
| `* item` | bullet point |
| `\n\n` | paragraph break |

## Steps

1. Before running anything, check the credentials are set in the current shell:

   ```bash
   test -n "$ATLASSIAN_USER" && test -n "$ATLASSIAN_TOKEN" && echo "credentials present"
   ```

   If either is unset, stop immediately and point the user at [atlassian-credentials.md](../../../docs/ai/atlassian-credentials.md) for setup. Do not run the script anyway, and never ask the user to paste credentials or tokens into the conversation.

2. Run the create script:

   ```bash
   node .ai/skills/tools/jira/create-ticket.mjs --summary "..." --description "..." [other options]
   ```

   Pass description via `--description "..."`. For multi-line descriptions, write the content to a variable and pass it as a string — do not use a temp file.

3. **If the script fails for any reason, stop immediately.** Report the exact error to the user and ask them to fix it before retrying. Do not fall back to creating the ticket via the Jira UI or guessing the outcome.

4. Return the script's output to the caller. The output will include the ticket key and URL:

   ```
   Created: NRF2-XXXX
   URL: https://eaflood.atlassian.net/browse/NRF2-XXXX
   ```
