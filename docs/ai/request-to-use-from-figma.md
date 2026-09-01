# Request to use from Figma skill

Extracts a node/screen from a Figma prototype file and generates a working "request to use" page (view, view model, routes) under `frontend/src/server/request-to-use/`.

Skill definition: [`.ai/skills/request-to-use-from-figma/SKILL.md`](../../.ai/skills/request-to-use-from-figma/SKILL.md)

## Prerequisites

A `FIGMA_TOKEN` environment variable (set in the shell or the user's shell profile).

## Usage

```
/request-to-use-from-figma <figma-url-or-file-key> <route-id>
```

A `node-id` query parameter in the Figma URL scopes extraction to that single frame. `<route-id>` (e.g. `email-confirmation`) names the generated page folder and route path.

## Notes

- These are prototype pages: no form validation or tests are generated
- Worked example: `frontend/src/server/request-to-use/nrl-reference`
- Journey wiring (back link / next page) is left as placeholders when the Figma JSON doesn't say — flagged in the summary for manual follow-up
