# Read Confluence page skill

Fetches a Confluence page's details (title, space, version, labels, body HTML) by page ID or URL via the Confluence API script.

Skill definition: [`.ai/skills/read-confluence-page/SKILL.md`](../../.ai/skills/read-confluence-page/SKILL.md)

## Prerequisites

`ATLASSIAN_USER` and `ATLASSIAN_TOKEN` environment variables. See [atlassian-credentials.md](./atlassian-credentials.md) for setup.

## Usage

```
/read-confluence-page <page_id_or_url> [format]
```

`format` is optional: `full` (default), `summary`, or `json`.

## Notes

- If the script fails, stop and report the exact error — no scraping the Confluence UI or guessing contents
