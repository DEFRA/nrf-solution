# Jira comment

Only add a Jira comment if the starting URL is the test environment, `https://nrf-frontend.test.cdp-int.defra.cloud/`. For any other URL (localhost or another deployed environment), post nothing to the ticket.

After the results table, add a comment to the Jira ticket confirming the browser test was run, as a single line plus detail only for scenarios that didn't pass. Always start with `[test-in-browser skill]` so it's clearly distinguished from a comment added by a human:

- All scenarios passed: `[test-in-browser skill] Browser tested against <url> on <date>: all <N> acceptance criteria passed.`
- Otherwise: `[test-in-browser skill] Browser tested against <url> on <date>: <P> of <N> acceptance criteria passed.` followed by one line per failed or partial scenario, `- Scenario <n> - <title>: <short reason>`.

Scenarios that landed on a page that isn't built yet count as passed; don't list them.

Post it with:

```
echo "<comment>" | node .ai/skills/tools/jira/add-comment.mjs <ticket> --replace-prefix "[test-in-browser skill] Browser tested against" -
```

On a re-run, `--replace-prefix` replaces your earlier browser-test comment (and removes older duplicates), so the ticket only ever carries the latest result. Don't mention earlier runs in the new comment. If the script fails, report the exact error and don't retry or call the Jira API directly.
