---
name: data-catalogue
description: Work on the NRF Data Catalogue — the data asset register describing every data asset the service produces, consumes, stores or transmits, against Defra Minimum Metadata V0.3. TRIGGER when asked to update, review, extend or check the catalogue or data dictionary; when a migration adds or removes a table; when a reference layer is onboarded or retired; or when a new external integration is added. Also covers checking the workbook for drift against the code.
tools: Bash, Read, Write, Glob, Grep
---

## What the catalogue is

The data asset register for the **Nature Restoration Levy (NRL)** service: every
data asset the service produces, consumes, stores or transmits, described
against **Defra Minimum Metadata V0.3** so it is interoperable with the Defra
Enterprise Data Catalogue (EDC) and the ESDA register.

> **NRF and NRL.** The service was renamed from Nature Restoration *Fund* to
> Nature Restoration *Levy*, and quote references now read `NRL-nnnnnn`
> (changeset `2.9`). The old name survives in identifiers that were not renamed
> with it, and these must be left alone: the repositories (`nrf-solution`,
> `nrf-backend`, `nrf-impact-assessor`, …), the databases (`nrf_backend`,
> `nrf_impact`), the Jira project key (`NRF2-`), and the workbook's own filename
> (`NRF Data Catalogue_V0.1.xlsx`). Do not blanket-rename — check whether a
> given `NRF` is prose or an identifier.

**The workbook is not in this repository.** It is maintained in SharePoint —
`.gitignore` carries `NRF Data Catalogue*.xlsx` so a local copy cannot be
committed by accident.

### Where it lives

| | |
| --- | --- |
| Current version | [`NRF Data Catalogue_V0.1.xlsx`](https://defra.sharepoint.com/:x:/r/sites/T_WorkDelivery99/Shared%20files/Nature%20Restoration%20Fund/04%20Architecture%20%26%20Assurance%20docs/Data/NRF%20Data%20Catalogue_V0.1.xlsx) |
| Folder | [`04 Architecture & Assurance docs/Data`](https://defra.sharepoint.com/:f:/r/sites/T_WorkDelivery99/Shared%20files/Nature%20Restoration%20Fund/04%20Architecture%20%26%20Assurance%20docs/Data) |

Requires access to the `T_WorkDelivery99` SharePoint site.

**The version is in the filename**, so the file link breaks when `V0.2` is
issued. Use the folder link to find the current one, and update the file link
here when the version changes.

Download a fresh copy rather than reusing one from a Downloads folder — a local
copy tells you nothing about whether SharePoint has moved on, and SharePoint is
the system of record. If you cannot reach it, ask the user rather than working
from a stale file.

Why it is not committed: it is a binary `.xlsx` with no meaningful diffs and
unresolvable merge conflicts, roughly a quarter of it is `TBC` awaiting
decisions from people who do not have repo access, and most of the rest is
organisational governance rather than code-derived fact.

### Sheets

| Sheet | Holds |
| --- | --- |
| `Version Control` | revision history of the workbook |
| `Introduction` | scope and how to read it |
| `Source Commits` | the pinned submodule SHAs every `file:line` reference resolves against |
| `Data Asset Register` | one row per **data asset** — the governance-level register |
| `Register Notes` | qualifications on individual register rows |
| `Supply Extension` | supplier, licence and refresh detail for consumed data |
| `Data Dictionary` | one row per **column** — the physical schema |
| `References` | source documents and standards |
| `Minimum Metadata` | the Defra field set this implements |
| `Controlled Vocabulary` | permitted values |
| `Gap Analysis` | known gaps, numbered `Gnn` |

## The rule that matters most

**Every value is `confirmed`, `inferred` or `TBC`.**

- `confirmed` — cite the evidence as `file:line`.
- `inferred` — state the reasoning *and* what would confirm it.
- `TBC` — name who would know. **A `TBC` is a correct answer.**

This exists because an earlier draft asserted facts the repository does not
contain: it named a supplier for nine reference layers when a repo-wide search
finds that organisation mentioned once, in a test-data README. Inventing a
plausible value is worse than leaving it blank, because a register is used to
make decisions about data the team does not otherwise have visibility of.

If you cannot evidence it, do not write it. Say who to ask.

## Asset grain

One row in the register is a **governance decision**, not a physical table.

- Several tables are one asset when they share owner, retention rule, access
  decision and origin — the four `data_sync_*` tables are one audit mechanism,
  so one row.
- One table splits into several assets when different rows have different
  origins — `lookup_table` holds two logical datasets, so two rows.

The **Asset Grain** column states this per row so it can be audited rather than
inferred. When you add an asset, fill it in.

The Data Dictionary is the opposite: one row per **column**, physical, no
judgement. Keep the two straight — a new table always means new Data Dictionary
rows, but not necessarily a new register row.

## Reading the workbook

`read-sheet.py` in this directory reads any sheet with no dependencies and no
install step, which matters because the file is read from a Downloads folder,
not from a project with a virtualenv.

```bash
python3 .ai/skills/data-catalogue/read-sheet.py "NRF Data Catalogue_V0.1.xlsx" "Data Dictionary"
```

Output is pipe-separated rows, header first. Import `sheet(path, name)` from it
for anything more involved.

Do not rewrite this from scratch. Two things silently return nothing: the
`Relationship` attribute order varies by writer (openpyxl emits `Type`,
`Target`, `Id`), and this workbook has **no** `sharedStrings.xml` — its cells
are inline strings, so assuming that part exists raises `KeyError`.

## Checking it against the code

The schema is the part of the catalogue that goes stale, because it is derived
from code that keeps moving. **Check it against the live database**, not against
the migrations — see the `generate-db-diagram` skill for how the databases are
brought up and queried.

Bring the databases up and apply migrations:

```bash
docker compose up -d postgres liquibase impact-assessor-migration
```

Then compare the catalogued tables with what exists — load `read-sheet.py`
by path, since its filename is not an importable module name:

```python
import runpy, subprocess
sheet = runpy.run_path('.ai/skills/data-catalogue/read-sheet.py')['sheet']

rows = sheet(WORKBOOK, 'Data Dictionary')
hdr = rows[0]
ti, di = hdr.index('Table'), hdr.index('Database')
catalogued = {(r[di], r[ti]) for r in rows[1:] if len(r) > ti and r[ti]}

EXCL = "'databasechangelog','databasechangeloglock','spatial_ref_sys','alembic_version'"
for db in ('nrf_backend', 'nrf_impact'):
    q = f"SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ({EXCL}) ORDER BY 1;"
    out = subprocess.run(['docker', 'compose', 'exec', '-T', 'postgres', 'psql',
                          '-U', 'postgres', '-d', db, '-t', '-A', '-c', q],
                         capture_output=True, text=True).stdout
    live = {x for x in out.split('\n') if x.strip()}
    doc = {t for (d, t) in catalogued if d == db}
    print(db, 'in DB not catalogued:', sorted(live - doc))
    print(db, 'catalogued not in DB:', sorted(doc - live))
```

Report both directions. A table in the database that nobody catalogued is a
governance gap; a catalogued table that no longer exists means the register
describes something that was dropped.

Also check the **columns** of any table you are touching, not just the table
names — the failure this guards against was column-level (see Gap G14).

### Pinned source commits

The `Source Commits` sheet records the exact SHA of every submodule at
generation time. The ~1,180 `file:line` references only resolve against those
commits — line numbers move within days on the default branch.

Roughly half the references have no repo prefix (`src/config.js:146` rather than
`backend/src/config.js:146`). The rule, stated on that sheet: **a bare path is
relative to the submodule named in that row's `Service` column.**

Compare the pinned SHAs against `git submodule status`. If they have moved, the
references may point at lines that have shifted — say so rather than resolving
them against the current branch.

## When to update

Update — do not hand-patch around — whenever:

- a migration adds or removes a table or column,
- a reference layer is onboarded or retired,
- a new external integration is added,
- a retention, ownership or access decision is made that a `TBC` was waiting on.

The Data Dictionary is the sheet that moves most often; the register moves only
when a *governance* boundary changes.

## Who it goes to

The catalogue is not just an internal artefact — it is sent onward, and that is
the half most easily forgotten.

| Person | Role |
| --- | --- |
| **James Peacock** (`james.peacock@defra.gov.uk`) | receives the catalogue; send him the updated workbook whenever it changes |
| **Nick Allen** | Defra's existing data catalogues — what Defra already holds and how ours aligns to it |
| **Ian Shaw** | Natural England Data Strategist; audience for the schema documentation |

**When the catalogue is updated, send it to James Peacock.** That is a standing
obligation recorded on the Housekeeping Confluence page, not a one-off — the
register is only useful to Defra if the copy they hold is current.

Data Owners, Defra Data Protection and the metadata working group are the people
a `TBC` is usually waiting on. Name them in the cell rather than guessing.

## Known gaps

The `Gap Analysis` sheet numbers open gaps `Gnn`. The one worth knowing:

**G14** — `backend/docs/quote-database-diagram.md` was hand-maintained, fell four
changesets behind, and became the source of a wrong data dictionary in the first
draft of this catalogue. A stale diagram looks exactly like a fresh one. That
diagram is now generated by the `generate-db-diagram` skill; prefer it, or the
live database, over anything hand-written.

When you close a gap, update the sheet rather than deleting the row — the
history of what was wrong is part of the register's value.

## Related

- `generate-db-diagram` — generates the ER diagrams for both databases from the
  live schema. The authoritative answer to "what is actually in the database".
- `NRF - Asset Register.xlsx` — the **security assurance** register: CIA ratings
  per data lifecycle stage, describing target architecture. Complementary, not a
  substitute — it contains none of the consumed spatial reference data. Obtain
  current copies from their owners; neither register is held in this repo.
