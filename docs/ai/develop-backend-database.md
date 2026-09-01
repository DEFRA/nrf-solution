# Develop backend database skill

Reference for reading from or writing to the backend Postgres database (`nrf_backend`, schema `public`) — the quote domain and its Liquibase migrations.

Skill definition: [`.ai/skills/develop-backend-database/SKILL.md`](../../.ai/skills/develop-backend-database/SKILL.md)

## When to use

Load this skill before:

- Writing SQL against `nrf_backend`, or reading/writing its schema, tables, columns, or rows
- Adding or changing a Liquibase migration/changelog under `backend/changelog/`
- Adding a query or repository function under `backend/src/services/db/`
- Touching `backend/src/common/helpers/postgres.js`

Not for the impact-assessor database (`nrf_impact`, Alembic) — that's a separate service.

## Notes

- Start from the ERD at `backend/docs/quote-database-diagram.md`; regenerate with the `generate-db-diagram` skill after schema-changing migrations
- Never edit an already-applied changeSet; add a new one with a matching `<rollback>`
- Application queries go through `db.query(sql, params)` with parameterized values — never interpolate
