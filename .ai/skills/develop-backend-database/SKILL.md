---
name: develop-backend-database
description: >
  Reading from or writing to the backend Postgres DB database (`nrf_backend`, schema `public`) —
  the quote domain: `users`, `organisations`, `quotes`, `quote_access_tokens`,
  `quote_edp_results`, `quote_email_notifications`. TRIGGER when writing SQL, adding or changing a
  Liquibase migration/changelog under backend/changelog/, adding a query or repository function
  under backend/src/services/db/, touching backend/src/common/helpers/postgres.js, or otherwise
  reading/writing schema, tables, columns, or rows in the backend database. Not for the
  impact-assessor database (`nrf_impact`, Alembic).
---

## Overview

The backend (`nrf-backend`) owns one Postgres database, `nrf_backend` (schema `public`,
image `postgis/postgis`). It holds the quote domain: users, organisations, quotes, and
their related access tokens, EDP levy results, and email notifications.

- **Schema reference (ERD):** [backend/docs/quote-database-diagram.md](../../../backend/docs/quote-database-diagram.md) —
  the current tables, columns, keys, and relationships. Read this before writing any query
  or migration so you know the real shape of the data. If it looks stale after a migration,
  regenerate it with the `generate-db-diagram` skill.
- **Migrations:** [backend/changelog/](../../../backend/changelog/) — Liquibase XML changelogs,
  applied automatically on `tilt up`. `db.changelog.xml` is the master file; it `<include>`s one
  file per version (`db.changelog-N.M.xml`) in order. To change the schema, add a new
  `<changeSet id="..." author="...">` to the next version file (or a new one, included from the
  master) — never edit an already-applied changeSet. Give every `createTable`/`addColumn` a
  matching `<rollback>`. Prefer typed Liquibase elements (`createTable`, `addColumn`,
  `addForeignKeyConstraint`, etc.); drop to a raw `<sql>` block only for things Liquibase can't
  express (e.g. `CHECK` constraints, generated columns).

  **After applying a schema-changing migration, you must regenerate the ERD**
  (`backend/docs/quote-database-diagram.md`) using the `generate-db-diagram` skill, which reads
  the live `nrf_backend` database (required — the changelog alone is not a reliable source).
  The migration task is not complete until the diagram reflects the new schema.

This is **not** the impact-assessor database (`nrf_impact`, schema `public`, Python /
Alembic) — that's a separate service and out of scope here.

## jsonb columns need a CHECK constraint

A bare `jsonb` column documents nothing and enforces nothing: the ERD shows only
`jsonb <name>`, the catalogue's Data Dictionary gets a row with no shape, and any
JSON value at all can be written. **When a migration adds a `jsonb` column, add a
CHECK constraint describing its shape in the same changeSet** (or the next one, if
the column is already applied). `generate-db-diagram` step 6 harvests CHECK
constraints, so the structure then reaches both the diagram and the catalogue
without anyone hand-writing it.

Worked example: `catchments` on `quote_edp_results` — column in changeSet `30`,
constraint in changeSet `31` (`backend/changelog/db.changelog-3.2.xml`).

Three things that decide whether the constraint is worth having:

- **Assert required keys, types and ranges — not the absence of extra keys.** A
  permissive constraint lets the producer (e.g. the impact assessor) add a field
  without a lockstep migration and deploy. Forbidding unknown keys turns every
  upstream addition into a coordinated release.
- **Use `jsonb_path_exists(col, '...')`, never the `@?` operator.** Liquibase sends
  changeSets through JDBC, which rewrites the `?` in `@?` as a bind parameter
  (`@$1`) and the changeSet fails with a syntax error. The function form is
  equivalent and survives.
- **A nullable column needs `col IS NULL OR (...)`**, and the ERD comment should say
  NULL passes — a nullable jsonb with a CHECK is still optional, which is not
  obvious from the constraint definition.

The shape is a filter that must match *nothing*. Use `lax` for the key/type/range
checks (in `strict` mode a missing key is a structural error that is suppressed, so
`!exists(...)` silently never fires) and a separate `strict` clause to reject
elements that are not objects:

```sql
ALTER TABLE <table>
  ADD CONSTRAINT ck_<table>_<column> CHECK (
    <column> IS NULL
    OR (
      jsonb_typeof(<column>) = 'array'
      AND NOT jsonb_path_exists(<column>, 'strict $[*] ? (@.type() <> "object")')
      AND NOT jsonb_path_exists(<column>, 'lax $[*] ? (
           !exists(@.someKey) || @.someKey.type() <> "string"
        || !exists(@.someNumber) || @.someNumber.type() <> "number"
           || @.someNumber < 0 || @.someNumber > 100)')
    )
  );
```

Liquibase cannot express a CHECK, so it goes in a raw `<sql>` block with a
`<rollback>` that drops the constraint by name. Before committing, check the
predicate against the live DB with a `VALUES` list of good and bad samples — a
filter that matches nothing accepts everything, and that failure is silent.

Validation at the API boundary (a joi schema) is not a substitute: it does not
reach the ERD or the catalogue, and it does not cover writes that arrive any other
way.

## Reading/writing data in application code

- The Postgres connection pool is a Hapi plugin,
  `backend/src/common/helpers/postgres.js`, decorating `server.pg` and `request.pg` (a
  `pg-pool` instance). In route handlers, pass `request.pg` down as `db`.
- Query functions live under `backend/src/services/db/<domain>/`, one file per operation
  (e.g. `quotes/create-quote.js`, `quotes/get-quote.js`), exporting a `db<Verb><Noun>`
  function that takes `{ db, ...args }` and runs parameterized SQL via `db.query(sql, params)`.
  Follow this structure for new queries rather than inlining SQL in controllers.
- **Always parameterize** (`$1`, `$2`, ...) — never interpolate values into SQL strings.
- Shared row-mapping/select logic (e.g. `quotes/quote-row-mapper.js`) is factored out when a
  column set is reused across queries (list + get).
- Unit tests for `services/db/<domain>/` functions mock `db.query` directly
  (`vi.fn().mockResolvedValueOnce({ rows: [...] })`) and assert on the SQL text
  (`expect.stringContaining(...)`) and bound params — see `quotes/create-quote.test.js` for the
  pattern.
- API-level tests exercise a **real Postgres container** — no DB mocking. `setupTestServer()`
  (`test-utils/setup-test-server.js`) boots the real Hapi server via `createServer()`, wiring up
  the real `request.pg` pool against the running `postgres` compose service, so requests actually
  read/write `nrf_backend`. Use this to test DB-touching behaviour end-to-end (e.g. a PATCH that
  writes rows, then a GET that reads them back) rather than mocking the DB layer. See
  `api/quote/patch-controller.test.js` for the pattern — it posts/patches/gets through
  `server.inject` and asserts against rows read back from the database
  (`getAccessTokenRowsForReference`, `getEmailNotificationRowsForReference` in
  `test-utils/quote-request-helpers.js`).
- Where the change consumes node-postgres query results, check numeric coercion — `COUNT()` and bigint columns come back as strings, so `count + 1` concatenates instead of adds. A unit test that mocks the query result as a number will not catch this; flag it.

