# Sync Swagger skill

Audits and fixes `@openapi` JSDoc annotations across all API route and controller files so the Swagger documentation matches the actual endpoint implementations.

Skill definition: [`.ai/skills/sync-swagger/SKILL.md`](../../.ai/skills/sync-swagger/SKILL.md)

## Usage

Run for both sub-repos:

```
/sync-swagger
```

Or scope to one sub-repo by passing it as an argument:

```
/sync-swagger frontend
```

```
/sync-swagger backend
```

## What it checks

For each endpoint: HTTP method and path, request body schema (matching `validate.payload`), path and query parameters, response status codes, and tags. Missing `@openapi` blocks are added; incorrect or incomplete ones are fixed. Runs `npm test` in each sub-repo after making changes.
