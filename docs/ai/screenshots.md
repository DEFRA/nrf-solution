# Screenshots skill

Captures screenshots of all pages in a user journey by walking through the flow automatically.

Skill definition: [`.ai/skills/screenshots/SKILL.md`](../../.ai/skills/screenshots/SKILL.md)

## Usage

Pass a journeys markdown file path (looked up in `docs/user-journeys/` by default) or a single URL:

```
/screenshots docs/user-journeys/create-quote.md
```

```
/screenshots http://localhost:3000/quote/start
```

## Output

Screenshots are saved to `docs/user-journeys/screenshots/<yyyy-mm-dd-journey-file-name>/`, named `01-page-name.png` with incrementing numbers.

For form pages with validation, three screenshots are captured: the validation error state, the valid entry state, and the pre-filled form after navigating back.
