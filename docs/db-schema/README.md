# Database schema generator

Generates [`docs/database-schema.md`](../database-schema.md) — every SQL table in
the service, with ER diagrams — from the migration sources in each repo.

```bash
node docs/db-schema/generate.js          # write the document
node docs/db-schema/generate.js --check  # exit 1 if it is out of date (CI)
node docs/db-schema/generate.js --stamp  # append the generating commit
```

No dependencies and no install step; Node >=24 (`nvm use`). No database is
required — it reads the migrations, so it runs anywhere.

This file is the **reference** for how the generator works and how to extend it.
For the day-to-day process — when to run it, what its warnings mean, what to do
when it refuses — see
[running-workflow.md § Documenting the schema](../running-workflow.md#documenting-the-schema).

## Why generated

`backend/docs/quote-database-diagram.md` was written by hand, fell four
changesets behind, and became the source of a wrong data dictionary — gap
**G14** in the [data catalogue](../data-catalogue/README.md). A stale diagram
looks exactly like a fresh one, so nothing caught it.

Everything here follows from that: the document is derived, CI fails when it
drifts, and the generator additionally reports **any other** hand-maintained ER
diagram in the tree that disagrees with the real schema. It currently reports
`quote-database-diagram.md`, which is still stale.

## What it reads

Sources are **discovered**, not configured — the tree is scanned so a new
service with its own database is picked up rather than silently missed. Today
that finds three:

| Source | Tool | Database |
| --- | --- | --- |
| `backend/changelog` | Liquibase | `nrf_backend` |
| `impact-assessor/alembic/versions` | Alembic | `nrf_impact` |
| `impact-assessor/changelog` | Liquibase | `nrf_impact` |

Database names come from `compose.yml`: the service that runs a migration names
both its source directory and the database it targets, so the mapping is derived
rather than assumed.

`impact-assessor` defines its schema **twice** — Alembic locally, Liquibase on
the deployed platform. The generator parses both and compares them; if they ever
disagree, that lands in the document and fails the run.

## The traps

Each of these produced a wrong answer before it was handled, which is why they
are worth stating:

- **Liquibase `<rollback>` blocks hold the inverse operation.** An `addColumn`
  changeset contains a `dropColumn` rollback, so parsing rollbacks as real
  operations cancels out every column ever added.
- **Alembic's `downgrade()` is the same trap**, and revisions must be ordered by
  `down_revision` — the later revision ids are content hashes that sort
  arbitrarily by filename.
- **Schema changes also arrive as raw SQL.** `quotes.reference` exists only in a
  raw `<sql>` block, and `quote_edp_results` was dropped and recreated there with
  a different column set.
- **Alembic creates seven tables inside a `for` loop** over a module constant, so
  they do not appear as literal `create_table("name", ...)` calls at all.
- **`default=uuid4` never reaches Postgres.** SQLAlchemy applies it in Python, so
  reading only the migrations would imply a server default that does not exist.

## Failing loudly

The generator **refuses to write** if it meets a change it does not understand —
an unhandled Liquibase change type, or raw SQL it cannot classify — and exits 2
naming the changeset. Publishing a plausible-looking but incomplete schema is
the failure this whole thing exists to prevent, so silence is never the fallback.

Teach `lib/` to read the new construct rather than working around the error.

## Layout

| File | Responsibility |
| --- | --- |
| `generate.js` | entry point: collect, cross-check, render, write |
| `lib/discover.js` | find migration sources and datastores across the tree |
| `lib/liquibase.js` | replay a Liquibase changelog |
| `lib/alembic.js` | replay an Alembic revision chain |
| `lib/models.js` | read SQLAlchemy models; cross-check against migrations |
| `lib/sql.js` | classify the raw SQL both tools embed |
| `lib/xml.js` | minimal XML reader (Liquibase nests meaningfully) |
| `lib/python.js` | minimal Python reader (constants, f-strings, loops) |
| `lib/render.js` | Markdown tables and Mermaid ER diagrams |
| `lib/stale.js` | find other ER diagrams that disagree with the schema |

`docs/data-catalogue/check-drift.js` reuses `lib/liquibase.js` and
`lib/alembic.js` rather than keeping a second reader — two readers would drift
apart, and the subtleties above are exactly where drift hides.

## Determinism

The output contains no dates, no submodule SHAs and nothing environment-derived,
so `--check` fails only when the schema has genuinely changed. Provenance is git
history. Use `--stamp` when publishing outside the repo, where that context is
not available.
