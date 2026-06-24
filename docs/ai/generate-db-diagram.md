# Generate DB diagram skill

Generates or updates the Mermaid ERD of the backend Postgres database at `backend/docs/quote-database-diagram.md`.

Skill definition: [`.ai/skills/generate-db-diagram/SKILL.md`](../../.ai/skills/generate-db-diagram/SKILL.md)

## Prerequisites

The Postgres container must be running (`tilt up` from the `nrf-solution` root). The skill reads directly from the live database — it will not fall back to the Liquibase changelog if the DB is unavailable.

## Usage

```
/generate-db-diagram
```

Re-run after any schema-changing migration to refresh the diagram.

## Notes

- Sources schema from the live `nrf_backend` Postgres instance
- Cross-references the Liquibase changelog for column intent (generated columns, defaults)
- Excludes Liquibase bookkeeping tables and the PostGIS `spatial_ref_sys` table
- Output is committed inside the `backend/` submodule, not the meta-repo
