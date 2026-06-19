---
name: sync-swagger
description: >
  Audit and fix the @openapi JSDoc annotations across all API route and controller files in
  frontend/ and backend/ so the Swagger documentation matches the actual endpoint
  implementations. Run for one or both sub-repos.
---

Audit and fix the @openapi JSDoc annotations across all API route and controller files so the Swagger documentation matches the actual endpoint implementations.

## Sub-repo config

| Sub-repo | Swagger plugin |
| --- | --- |
| `frontend/` | `src/server/plugins/swagger.js` |
| `backend/` | `src/plugins/swagger.js` |

### Frontend architecture notes

- Uses `swagger-jsdoc` to generate an OpenAPI spec from `@openapi` JSDoc annotations and serves:
  - `/swagger.json` — the raw OpenAPI spec
  - `/docs` — Swagger UI page
  - `/swagger-ui/{param*}` — static assets from `swagger-ui-dist`
  - `/swagger-ui/swagger-initializer.js` — custom initializer route (overrides the wildcard) that points Swagger UI at `/swagger.json`
- **CSP constraint**: the app uses Blankie with nonce-based CSP. The `/docs` page must **not** contain inline scripts. All JavaScript must be loaded via external `<script src="...">` tags.
- The plugin is registered in `src/server/server.js` after the router (so `@hapi/inert` is available).

## Steps

Repeat for each sub-repo in scope:

1. Read the swagger-jsdoc config in the sub-repo's swagger plugin (see table above) to find the file globs that are scanned for annotations (the `apis` array).

2. For every file matched by those globs, read the file and compare:
   - The `@openapi` JSDoc block (if present) against the actual route definition below it.
   - Check: HTTP method, path, request body / payload schema, path and query parameters, response status codes and shapes.
   - If a route exists but has no `@openapi` block, add one.
   - If an `@openapi` block is present but incorrect or incomplete, fix it.

3. Specific things to verify for each endpoint:
   - **Method and path** match the route's `method` and `path` fields.
   - **Request body**: if the route has `validate.payload` (Joi), the `@openapi` `requestBody` schema should list the same fields, types, required fields, and formats.
   - **Path parameters**: if the route path has `{param}` segments or `validate.params`, the `@openapi` block should have matching `parameters` entries.
   - **Query parameters**: if the route has `validate.query`, document them.
   - **Response codes**: match what the handler actually returns (e.g. `h.response().code(201)` → 201, Boom.notFound → 404).
   - **Tags**: should be present and grouped logically (e.g. by resource).

4. After making changes in a sub-repo, run `npm test` from that sub-repo directory to verify nothing is broken.

5. Summarise what was changed or confirmed correct in each sub-repo.
