# Quote journey page skill

Reference for conventions and file structure for quote journey pages in `nrf-frontend`. Read before creating or modifying any page under `frontend/src/server/quote/`.

Skill definition: [`.ai/skills/quote-journey-page/SKILL.md`](../../.ai/skills/quote-journey-page/SKILL.md)

## When to use

This skill is a reference document rather than an executable workflow. Invoke it when:

- Creating a new page under `frontend/src/server/quote/`
- Reviewing how the PRG validation flow works
- Checking Joi rules for a specific input type
- Looking up session cache helpers

## Covers

- Standard file structure: `routes.js`, `get-view-model.js`, `form-validation.js`, `get-next-page.js`
- `quoteController` / `quotePostController` wiring
- PRG validation flow (GET reads session flash; POST saves flash and redirects)
- Nunjucks template conventions
- Joi schema rules per input type (radios, checkboxes, text, email, number)
- Session cache helpers
- Page test and accessibility test patterns
