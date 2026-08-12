# NRF data catalogue

The data asset register for the NRF service: every data asset the service produces,
consumes, stores or transmits, described against
[Defra Minimum Metadata V0.3](#references) so it is interoperable with the Defra
Enterprise Data Catalogue (EDC) and the ESDA register.

**The workbook itself is not in this repository.** It is maintained in SharePoint.
This directory holds the tooling that produced it and the check that stops it going
stale.

## Why the workbook is not committed

- It is a binary `.xlsx` — no meaningful diffs, and merge conflicts are unresolvable.
- Roughly a quarter of it is `TBC` awaiting decisions from Data Owners, Defra Data
  Protection and the metadata working group — people who do not have repo access.
- Once those are filled in, most of the content is organisational governance, not
  code-derived fact.

`.gitignore` carries `NRF Data Catalogue*.xlsx` so a local copy cannot be committed
by accident.

## Why that is a risk, and what guards it

A code-derived document held outside the code will drift. That already happened:
`backend/docs/quote-database-diagram.md` fell four changesets behind — it listed
four dropped columns and omitted two added ones — and was the source of a wrong data
dictionary in the first draft of this catalogue. It is logged as gap **G14**.

Two things guard against a repeat.

### 1. Pinned source commits

The workbook has a **Source Commits** tab recording the exact SHA of every submodule
at generation time. Its ~1,180 `file:line` references are only resolvable against
those commits — line numbers move within days on the default branch.

Roughly half the references have no repo prefix (`src/config.js:146` rather than
`backend/src/config.js:146`). The rule, stated on that tab: a bare path is relative
to the submodule named in that row's **Service** column.

### 2. The drift check

```bash
node docs/data-catalogue/check-drift.js ~/Downloads/"NRF Data Catalogue_V0.1.xlsx"
```

No dependencies and no install step — an `.xlsx` is a ZIP of XML, and the script
reads it with the built-in `zlib`. Run `nvm use` first (Node >=24).

Exits `0` for no drift, `1` if it finds any — safe to wire into CI against a copy
pulled from SharePoint. It checks:

| Check | Catches |
| --- | --- |
| Tables in `backend/changelog/` vs the Data Dictionary | a migration added a table nobody catalogued |
| Tables in `impact-assessor/app/models/db.py` vs the Data Dictionary | a new reference layer |
| `quotes` columns, replaying every add and drop in changeset order | the exact G14 failure |
| Pinned SHAs vs current `git submodule status` | references silently pointing at moved lines |

Two parsing subtleties it handles, both of which produced false results first time:

- **Liquibase `<rollback>` blocks hold the inverse operation.** An `addColumn`
  changeset contains a `dropColumn` rollback, so parsing rollbacks as real
  operations cancels out every column ever added. They are stripped before parsing.
- **`quotes.reference` is created by raw `<sql>`** and cannot be parsed from XML.
  The script reports it as unverifiable rather than as a missing column.

System tables are deliberately out of scope: `databasechangelog`,
`databasechangeloglock`, `spatial_ref_sys`, `alembic_version`.

## Regenerating

`extract-facts.workflow.js` is the agent pipeline that produced the register: six
extraction lenses over the codebase, each independently fact-checked by a second
agent, plus a specification pass for the consumed-data fields.

Its governing rule, and the reason for the second agent: **an earlier draft asserted
facts the repository does not contain**, naming a supplier for nine reference layers
when a repo-wide search finds that organisation mentioned once, in a test-data
README. Every value must be `confirmed` (with `file:line`), `inferred` (with the
reasoning and what would confirm it), or `TBC` (naming who would know). A `TBC` is a
correct answer.

Regenerate — do not hand-patch — whenever a migration adds or removes a table, a
reference layer is onboarded or retired, or a new external integration is added.

> The script that rendered the facts into the `.xlsx` was lost with a temporary
> working directory and would need rewriting. The extraction pipeline above is the
> substantive part; the renderer was formatting.

## Asset grain

One row is a **governance decision**, not a physical table.

Several tables are one asset when they share owner, retention rule, access decision
and origin — the four `data_sync_*` tables are one audit mechanism, so one row. One
table splits into several assets when different rows have different origins —
`lookup_table` holds two logical datasets, so two rows. The **Asset Grain** column
states this per row so it can be audited rather than inferred.

## References

| | |
| --- | --- |
| Defra Minimum Metadata Standard V0.3 | the field set this register implements |
| `NRF - Asset Register.xlsx` | the **security assurance** register — CIA ratings per data lifecycle stage, describing target architecture. Complementary, not a substitute: it contains none of the consumed spatial reference data. Obtain current copies from their owners; neither is held in this repo. |
