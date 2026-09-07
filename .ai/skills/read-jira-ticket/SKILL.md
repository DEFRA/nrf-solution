---
name: read-jira-ticket
description: Fetch a Jira ticket's details (summary, description, acceptance criteria, testing notes) by ticket ID. Use whenever another skill or task needs to read a Jira ticket.
---

## Parameters

`args` is the Jira ticket ID, e.g. `NRF2-358`.

## Steps

1. Before running anything, check the credentials are set in the current shell:

   ```bash
   test -n "$ATLASSIAN_USER" && test -n "$ATLASSIAN_TOKEN" && echo "credentials present"
   ```

   If either is unset, stop immediately and point the user at [atlassian-credentials.md](../../../docs/ai/atlassian-credentials.md) for setup. Do not run the script anyway, and never ask the user to paste credentials or tokens into the conversation.

2. Run the ticket script:

   ```bash
   bash .ai/skills/tools/jira/ticket.sh <ticket>
   ```

3. **If the script fails for any reason, stop immediately.** Report the exact error to the user and ask them to fix it before retrying. Do not fall back to scraping the Jira UI or guessing the ticket contents.

4. Return the script's output to the caller. Do not summarise or filter — the caller needs the full ticket details (description, acceptance criteria, testing notes, etc.) to do its job.
