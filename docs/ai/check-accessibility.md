# Check accessibility skill

Tests pages against accessibility standards by walking a user journey and checking each page state.

Skill definition: [`.ai/skills/check-accessibility/SKILL.md`](../../.ai/skills/check-accessibility/SKILL.md)

## Usage

Pass a journeys markdown file path (looked up in `docs/user-journeys/` by default) or a single URL:

```
/check-accessibility docs/user-journeys/create-quote.md
```

```
/check-accessibility http://localhost:3000/quote/start
```

## Output

Results are saved to `docs/accessibility-check-results/` as a markdown table with one row per failed check, grouped by journey and page. Passed pages are listed briefly; every failure includes the offending element and the rule it breaks.

## Checklist coverage

Page titles, headings hierarchy, images/alt text, forms (labels, hint text, error summary, focus management), tables, keyboard navigation, links, and map interactions.
