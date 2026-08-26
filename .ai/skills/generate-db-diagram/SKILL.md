---
name: generate-db-diagram
description: Generate or update the Mermaid ERD for a Postgres database in this solution — the backend quote DB (`nrf_backend`) and/or the impact-assessor reference DB (`nrf_impact`). Each diagram is written into the repo that owns the schema. Sources the schema from the live Postgres instance, cross-checked against that repo's migrations. Re-run to refresh after schema-changing migrations.
tools: Bash, Read, Write, Glob
---

## What this does

Produces a Mermaid entity-relationship diagram (ERD) for a Postgres database in
this solution and writes it **into the repo that owns that schema** — so the
diagram sits next to the migrations that define it, and changes in the same PR.

Two databases share one Postgres instance. They are independent: there are **no
foreign keys between them**, so each gets its own diagram and neither needs the
other.

| Database | Owner repo | Migrations | Output file |
| --- | --- | --- | --- |
| `nrf_backend` | `backend/` | Liquibase — `backend/changelog/` | `backend/docs/quote-database-diagram.md` |
| `nrf_impact` | `impact-assessor/` | Alembic — `impact-assessor/alembic/versions/` | `impact-assessor/docs/database-diagram.md` |

If the user names one database, do only that one. If they don't say, do both.

The schema is read from the **live Postgres instance**, which is the required
source of truth. The migrations are used only as a cross-reference for intent
(e.g. what a generated column means) — never as the sole source. If the live DB
is unavailable, stop rather than guessing.

## Scope — which tables

Include only application domain tables. Derive the list each run (step 1); do
**not** hard-code it. Apply these exclusions:

- `databasechangelog`, `databasechangeloglock` — Liquibase bookkeeping.
- `alembic_version` — Alembic bookkeeping.
- `spatial_ref_sys`, `geometry_columns`, `geography_columns`, `raster_columns`,
  `raster_overviews` — PostGIS internals (the image is `postgis/postgis`).

**Exclude whole schemas, not just tables.** PostGIS installs its extensions into
their own schemas: `nrf_backend` carries a `tiger` schema (44 tables of US census
geocoder reference data) and a `topology` schema. Neither is ours. Only `public`
holds application tables — filter on it rather than listing those tables out.

## Database access

Both databases run in the `postgres` service defined in `compose.yml` at the
`nrf-solution` root. Connect with `psql` **inside the container**; no local
client or exposed port is needed.

| Setting | Value | Source |
| --- | --- | --- |
| Service | `postgres` | `compose.yml` |
| Databases | `nrf_backend`, `nrf_impact` | `POSTGRES_DB`, `compose/init-postgres.sql` |
| User | `postgres` | `POSTGRES_USER` |
| Password | `password` | `POSTGRES_PASSWORD` (local dev only) |

Canonical command, run from the **`nrf-solution` root**:

```
docker compose exec -T postgres psql -U postgres -d <DATABASE> -c "<SQL>"
```

`-T` disables TTY allocation so it is scriptable. No password is needed because
`exec` runs as the trusted local socket user inside the container.

**These are local-dev credentials only** (committed in `compose.yml`). Real
environments get their secrets from CDP — never assume them off-box.

If these values drift, re-derive them from the `postgres` service in
`compose.yml` (`environment:` and `ports:`) and `compose/init-postgres.sql`.

## Preconditions

The live DB is **required**. Check it is up:

```
docker compose ps postgres
```

- **Up (healthy)** → go to step 1.
- **Not running** → bring up just what is needed, rather than the whole stack:

  ```
  docker compose up -d postgres liquibase impact-assessor-migration
  ```

  Those two migration services apply the changelogs and revisions and then exit,
  so the databases are current. Wait for `postgres` to report healthy and for the
  migration services to have exited successfully before continuing.

- If it still will not start, **stop** and tell the user. Do not reconstruct a
  schema from the migrations by hand — replaying cumulative migrations is
  error-prone and would not reflect the actual database.

**Do not assume the schema name.** Read it from the database (step 1). Several
files in this repo state that `nrf_impact` uses a schema called `nrf_reference`;
no migration creates one, and both databases in fact use `public`. This is
exactly the kind of claim the live DB settles — trust the query, not the prose.

## Steps

Run steps 1–5 once per database. `<DB>` is `nrf_backend` or `nrf_impact`;
`<SCHEMA>` is whatever step 1 reports.

### 1. List the in-scope tables and their schema

```
docker compose exec -T postgres psql -U postgres -d <DB> -t -A -F '|' \
  -c "SELECT schemaname, tablename FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog','information_schema','tiger','topology')
      ORDER BY schemaname, tablename;"
```

Drop the excluded tables listed under **Scope**. The remainder is your table set,
and the schema column tells you `<SCHEMA>` — expect `public` for both databases.

If a schema you do not recognise appears, find out what installed it before
including it. Extension schemas look like domain data at a glance.

### 2. Pull columns for each table

```
docker compose exec -T postgres psql -U postgres -d <DB> -t -A -F '|' \
  -c "SELECT table_name, column_name, data_type, udt_name, is_nullable,
             column_default, is_generated, generation_expression
      FROM information_schema.columns
      WHERE table_schema='<SCHEMA>'
        AND table_name IN (SELECT tablename FROM pg_tables WHERE schemaname='<SCHEMA>')
      ORDER BY table_name, ordinal_position;"
```

One query for the whole database is fine — it is far quicker than a query per
table. `udt_name` disambiguates `USER-DEFINED` types (`geometry`, `citext`), and
`is_generated` / `generation_expression` catch stored generated columns — that is
how you find, for example, that `quotes.reference` is generated from `id`.

The `IN (SELECT ... FROM pg_tables)` clause matters: `information_schema.columns`
includes **views**, so without it PostGIS's `geometry_columns` and
`geography_columns` appear as if they were tables.

`\d <SCHEMA>.<table>` gives a human-readable view of one table with its keys and
indexes in one place — useful to sanity-check steps 3–5.

### 3. Primary keys

```
docker compose exec -T postgres psql -U postgres -d <DB> -t -A -F '|' \
  -c "SELECT kcu.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type='PRIMARY KEY' AND tc.table_schema='<SCHEMA>'
      ORDER BY kcu.table_name, kcu.ordinal_position;"
```

### 4. Foreign keys — the relationships

```
docker compose exec -T postgres psql -U postgres -d <DB> -t -A -F '|' \
  -c "SELECT tc.table_name AS child, kcu.column_name AS child_col,
             ccu.table_name AS parent, ccu.column_name AS parent_col,
             rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
       AND tc.table_schema = ccu.table_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='<SCHEMA>'
      ORDER BY tc.table_name;"
```

Each row is one relationship: `child.child_col` references `parent.parent_col`.
`delete_rule` tells you whether it cascades.

### 5. Unique constraints and indexes

Worth including — a partial unique index is often the only place a business rule
is written down.

```
docker compose exec -T postgres psql -U postgres -d <DB> -t -A -F '|' \
  -c "SELECT tablename, indexname, indexdef
      FROM pg_indexes WHERE schemaname='<SCHEMA>' ORDER BY tablename, indexname;"
```

### 6. Build the Mermaid ERD

Assemble an `erDiagram`. Rules for a clean, valid diagram:

- One `TABLE { ... }` block per in-scope table, each column as
  `type name [PK|FK|UK] "comment"`.
- **Mermaid type tokens cannot contain spaces, commas or parentheses.**
  Normalise to a single token and put the real type in the comment:
  - `character varying(255)` → `varchar`
  - `timestamp with time zone` → `timestamptz`
  - `double precision` → `double`
  - `numeric(12,2)` → `numeric`
  - `ARRAY` (e.g. `text[]`) → `text_array`
  - `USER-DEFINED` → the `udt_name` (`geometry`, `citext`)
  - keep `integer`, `uuid`, `text`, `jsonb`, `boolean` as they are
- Mark `PK`, `FK` (from step 4) and `UK` (single-column unique from step 5).
- Add a short `"comment"` where the meaning is not obvious from the name, and for
  generated or defaulted columns. Keep comments free of `"` and `|`, which break
  the parser.
- One relationship line per FK, crow's foot, parent first:

  ```
  PARENT ||--o{ CHILD : "label"
  ```

  Pick a label that reads naturally (`owns`, `produces`, `granted via`). Note a
  nullable FK or a cascading delete in the comment rather than over-engineering
  the cardinality.

**Where many tables share one shape, draw it once.** `nrf_impact` has nine
reference-layer tables with an identical column set (`id`, `version`, `geometry`,
`name`, `attributes`, `created_at`). Rendering nine identical blocks is noise —
draw one, then list the tables that share it. Do not invent a placeholder entity
name for the shared shape; use one of the real tables and say which others match.

### 7. Write the output file

Each diagram goes in **its own repo**, so it lives beside the migrations that
define it. Create the directory if needed, then write:

| Database | File |
| --- | --- |
| `nrf_backend` | `backend/docs/quote-database-diagram.md` |
| `nrf_impact` | `impact-assessor/docs/database-diagram.md` |

Each file contains:

1. An H1 title and one-line description.
2. A line stating the **source** (live `<DB>` Postgres), the **schema**, and the
   **date generated** (today).
3. The ```` ```mermaid ```` fenced `erDiagram` block.
4. A short "Tables" section: each table with a one-line purpose.
5. Any indexes or constraints that carry a rule worth stating.

Overwrite an existing file — this skill regenerates the canonical diagram —
unless the user asks to keep history, in which case suffix the filename with the
date.

**`backend/` and `impact-assessor/` are git submodules.** Each diagram is
committed inside that submodule's own repo, not in `nrf-solution`. Stage and
commit from within the submodule directory, and raise a PR per repo.

### 8. Verify

- Re-read each written file.
- Check the Mermaid is well-formed: every table named in a relationship line also
  has a `{ }` block; no type token contains a space, comma or `(`; every `FK`
  column has a matching relationship line.
- Report the paths written, and per database the table and relationship counts.

## Cross-referencing the migrations

Use the owning repo's migrations to enrich the live schema with intent the raw
columns do not convey — never as the source of the structure itself:

- `backend/changelog/` — e.g. `quotes.reference` is `'NRF-'` plus a hashed,
  zero-padded id, defined in a raw `<sql>` block; changeset comments explain why
  a unique constraint or a sequence offset exists.
- `impact-assessor/alembic/versions/` — e.g. why a partial index covers only one
  `version`, or why a table was replaced.

Two things worth knowing when reading them, both of which mislead on a first
pass: a Liquibase `<rollback>` block holds the *inverse* of its changeset, and
Alembic's `downgrade()` does the same. Read the forward direction only.

If Postgres is down, **stop** (see Preconditions) — do not reconstruct from these.

## Notes

- `impact-assessor` also keeps a **parallel Liquibase changelog**
  (`impact-assessor/changelog/`) applied on the deployed platform, kept in step
  with Alembic by `impact-assessor/scripts/check_migration_parity.py`. The live
  database reflects whichever ran; the diagram is the same either way.
- Application-side defaults do not appear in `column_default`. `nrf_impact`'s
  UUID primary keys are generated in Python (`default=uuid4` in
  `impact-assessor/app/models/db.py`), so the database shows no default — worth a
  column comment, because a raw `INSERT` that omits them fails.
- Keep each diagram to domain tables. Excluding Liquibase, Alembic and PostGIS
  plumbing is the point of curating the set.
- These diagrams are generated artefacts — regenerate after schema-changing
  migrations rather than hand-editing. `backend/docs/quote-database-diagram.md`
  drifted four changesets behind exactly that way, and became the source of a
  wrong data dictionary.
