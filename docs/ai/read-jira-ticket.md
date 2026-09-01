# Read Jira ticket skill

Fetches a Jira ticket's details (summary, description, acceptance criteria, testing notes) by ticket ID via the Jira API script.

Skill definition: [`.ai/skills/read-jira-ticket/SKILL.md`](../../.ai/skills/read-jira-ticket/SKILL.md)

## Prerequisites

`ATLASSIAN_USER` and `ATLASSIAN_TOKEN` environment variables. See [atlassian-credentials.md](./atlassian-credentials.md) for setup.

## Usage

```
/read-jira-ticket NRF2-358
```

## Notes

- If the script fails, stop and report the exact error — no scraping the Jira UI or guessing contents
- Returns the full ticket details unfiltered; other skills (`test-in-browser`, feature-builder) consume it
