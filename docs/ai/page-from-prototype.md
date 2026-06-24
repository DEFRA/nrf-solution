# Page from prototype skill

Creates a new quote journey page and all associated files by parsing a prototype HTML page.

Skill definition: [`.ai/skills/page-from-prototype/SKILL.md`](../../.ai/skills/page-from-prototype/SKILL.md)

## Usage

```
/page-from-prototype <prototype-sub-path> <route-id> [content-markdown-sub-path]
```

- **prototype-sub-path** — relative path under `../nrf-prototypes/app/views/`, e.g. `nrf-quote-4/start.html`
- **route-id** — last segment of the page URL and the folder name, e.g. `start`
- **content-markdown-sub-path** (optional) — filename under `../nrf-prototypes/prompts/implementation/` containing real validation error messages

## What it creates

For a content-only page: `index.njk`, `get-view-model.js`, `routes.js`, `page.test.js`, `accessibility.test.js`

For a form page: all of the above plus `form-validation.js`, `form-validation.test.js`, `get-next-page.js`

The routes are automatically registered in `frontend/src/server/quote/index.js`.
