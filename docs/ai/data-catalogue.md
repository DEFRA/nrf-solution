# Data catalogue skill

Works on the NRF Data Catalogue — the data asset register describing every data asset the service produces, consumes, stores or transmits, against Defra Minimum Metadata V0.3 — and checks it for drift against the code.

Skill definition: [`.ai/skills/data-catalogue/SKILL.md`](../../.ai/skills/data-catalogue/SKILL.md)

## Prerequisites

The catalogue workbook is maintained in SharePoint (requires access to the `T_WorkDelivery99` site), not committed to the repo. Download a fresh copy before any update — a stale local copy tells you nothing.

## Usage

```
/data-catalogue
```

## When to use

- Asked to update, review, extend, or check the catalogue or data dictionary
- A migration adds or removes a table
- A reference layer is onboarded or retired
- A new external integration is added

## Notes

- Every catalogue value is `confirmed` (cited `file:line`), `inferred`, or `TBC`
- `read-sheet.py` (in the skill folder) dumps workbook sheets for inspection
- NRF→NRL renaming guidance: repository/database/Jira identifiers keep `NRF`; don't blanket-rename
