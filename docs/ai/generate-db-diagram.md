# Generate DB diagram skill

Generates or updates the Mermaid ERD of a Postgres database in this solution. Covers both databases, writing each diagram into the repo that owns the schema:

| Database | Repo | Migrations | Diagram output |
| --- | --- | --- | --- |
| `nrf_backend` | `backend/` | Liquibase — `backend/changelog/` | `backend/docs/quote-database-diagram.md` |
| `nrf_impact` | `impact-assessor/` | Alembic — `impact-assessor/alembic/versions/` | `impact-assessor/docs/database-diagram.md` |

Skill definition: [`.ai/skills/generate-db-diagram/SKILL.md`](../../.ai/skills/generate-db-diagram/SKILL.md)

## Prerequisites

The Postgres container must be running (`tilt up` from the `nrf-solution` root, or `docker compose up -d postgres liquibase impact-assessor-migration` for just the databases). The skill reads directly from the live database — it will not fall back to the migrations if the DB is unavailable.

## Usage

```
/generate-db-diagram
```

Re-run after any schema-changing migration to refresh the diagram. Both databases use schema `public`.

## Notes

- Sources schema from the live Postgres instance, one database at a time
- Cross-references each repo's migrations (Liquibase changelog / Alembic revisions) for column intent
- Excludes migration bookkeeping tables, PostGIS `spatial_ref_sys`, and the PostGIS `tiger`/`topology` extension schemas
- Output is committed inside the `backend/` / `impact-assessor/` submodules, not the meta-repo
