---
name: review-jira-story
description: Reviews a feature Jira story for dev-readiness — dev-ready prototype links, testable ACs, duplication, needed page URLs, redundant sections, and major inconsistencies with linked tickets. Returns a short, structured report. TRIGGER automatically, without being asked, after creating a new Jira story or making a significant update to an existing one (new or changed ACs, scope, context or links) — whether or not write-jira-story was used — and whenever asked to review, check or sanity-check a story. For a new-page story (question, dropout or confirmation page) use review-jira-story-new-page instead.
---

## Parameters

`args` is a Jira ticket reference (e.g. `NRF2-1260`) or full URL (e.g. `https://eaflood.atlassian.net/browse/NRF2-1260`). If given a URL, take the ticket key from it.

This skill is read-only: never edit the ticket, add comments or change links.

Prerequisite: `ATLASSIAN_USER` and `ATLASSIAN_TOKEN` must be set. See [atlassian-credentials.md](../../../docs/ai/atlassian-credentials.md).

## Principles

- **Review the main ticket only.** Related tickets are scanned solely to spot major inconsistencies with the main ticket. Never review, grade or list issues in a related ticket's own content.
- **Be super-concise.** The reader must be able to scan the report in seconds and understand every problem. Report only problems; never list items that pass (except the one-line Prototype links status). One short line per finding, with no filler, preamble, background or restating the ticket. Quote only the few words needed to locate it. Leave out anything that doesn't help the reader fix the ticket.
- **Be constructive.** Where a fix is obvious, give it in a few words.

## Steps

### Step 1 — Fetch the ticket

Use `read-jira-ticket` with the ticket key. Work from the raw description text.

**If the ticket has no description, stop and alert the user.**

**If the story is a new question, dropout or confirmation page, stop and tell the user to use `review-jira-story-new-page` instead.**

Note the status, parent key, subtasks and the `Linked Issues` section.

### Step 2 — Scan related tickets

Fetch with `read-jira-ticket`, in this order, stopping at 8 tickets in total:

1. Linked issues and subtasks.
2. Ticket keys mentioned in the description.
3. Sibling stories under the same parent (`node .ai/skills/tools/jira/get-epic-issues.mjs <PARENT_KEY>`; if it fails, carry on without). Only those whose summary overlaps this ticket's pages or behaviour; skip Done/Closed unless closely overlapping.

For each, read only enough to answer the Step 3 consistency question. Don't check its prototype links, testability or structure.

### Step 3 — Run the checks

Run every check. Collect all findings before reporting.

#### 1. Prototype links

Collect every prototype link in the description. Don't fetch or curl them — judge by URL only.

- If every path begins with `/handoffs`, report one line: "All prototype links are dev-ready." Don't list them.
- Otherwise list only the links that don't begin with `/handoffs` (not dev-ready) — Blocker.
- Also flag placeholders or non-full URLs, and error-state outcomes on any page with a form field not linking to the error preview: `?preview=1&error=1` (empty submission) or `?preview=1&error=format` (invalid format).
- Flag links whose path prefix (the folder or version segment before the page name) differs from the other links.

#### 2. Testability

For each AC scenario, flag it if it fails any of these and say why in a few words, with a suggested fix where obvious:

- Steps too generic to give one pass/fail condition (`correct behaviour occurs`, `an appropriate error`).
- Outcome not observable in the UI, network, an email or the database.
- `When`/`Then` joins distinct triggers or outcomes with `or` — suggest the split.
- `Given` needs a state the story never explains how to reach.
- Placeholders or unfilled template text (`[url]`, `TBD`, `TODO`).
- Visible UI or email copy quoted inline rather than linked to a prototype/design.
- Indirect reference that forces the reader elsewhere (`the fields listed in the Context`) — move the detail into the AC.
- Two scenarios whose steps wouldn't show which one failed (same `Then`, or one broad scenario already covering another) — suggest merge or a distinguishing condition.
- An empty or untitled scenario heading.
- Implementation detail in the steps (database or table names, which service or store holds data, endpoints, field or column names, code-level behaviour) unless a tester needs it to verify the outcome. Suggest rewording to the observable behaviour and moving any needed detail to Notes or the dev task.

#### 3. Duplication

- **Context ↔ ACs:** flag Context bullets or Notes that restate something an AC already asserts, or ACs that merely repeat Context. Recommend cutting the Context to what the ACs don't already say.
- **Within the description:** the same page, link or rule stated twice (for example a prototype link repeated as a URL, or a rule repeated across scenarios).

#### 4. Page URLs

Compare the page URLs section with the pages the ACs and Context actually require, in both directions. If there is no such section, report only pages the ACs name without stating a path. List only:

- URLs to **remove**: not needed to implement or test this ticket (page not named in any AC, or listed for context only).
- URLs **missing**: a page an AC names with no URL in the page URLs subsection (Blocker).
- Labels that aren't the page's own name, bullets with no route, duplicated routes.
- **Application page URLs in ACs:** paths/URLs of pages in this application must not appear in ACs. They belong only in the page URLs subsection, with the page title mapped to each URL; ACs then refer to pages by title. Flag any AC containing an application page URL or path and suggest replacing it with the page title (adding the page to the subsection if missing). External links (for example to GOV.UK) and prototype links are fine in ACs and need no entry in the subsection.

#### 5. Redundancy

Flag sections or headings that add no information, and recommend removing them:

- Sections containing only `TBC`, `TBD`, `?`, `N/A`, `None` or similar (for example an empty NFRs or Notes section).
- Empty headings, empty scenario stubs, stray template text.
- Terminology or glossary lists with undefined or truncated entries.
- NFR categories that don't apply (Browser & device compatibility and Page load performance should not be listed).

#### 6. Consistency with related tickets

Using the Step 2 scan, list only **major** inconsistencies between this ticket and the others:

- **Conflict:** same condition, different or opposite outcome — Blocker.
- **Duplicate:** same condition and outcome in both — say which ticket should own it.
- **Ownership overlap or gap:** both claim to build the same thing, or each lists it as the other's.
- **Referenced ticket** mentioned in the description but not linked in Jira, or that doesn't cover what this story says it does.
- **Blocking status:** this ticket depends on a ticket that is Won't do / closed, or this ticket's own status is Won't do / Done while still being reviewed.

Name the ticket key and the colliding point in one line. Do not report other problems with the related tickets.

#### 7. Other readiness

Report only if there's a problem, and keep to one line each:

- No user-need statement, no parent, or no `Given`/`When`/`Then` ACs.
- A `Generated from` Confluence page modified after the ticket's stamped date (possible drift). Fetch it with `read-confluence-page`. If the date can't be read, say so.
- Behaviour in Notes/Context/Out of scope that the story owns but no AC covers, or an AC asserting something stated nowhere else.
- Out-of-scope items that depend on another ticket but name no ticket or owner.
- Unresolved questions the ACs depend on (Blocker if the AC can't be tested without the answer).
- Judgement calls, phrased as a question, not a certainty — only when the story clearly touches them:
  - Accessibility / Security missing from NFRs for a story that adds a page or form (see [non-functional requirements](../../../docs/ai/non-functional-requirements.md)).
  - Stored/sent data with no backend or data-catalogue AC (see `data-catalogue`).
  - New page, step or dropout with no analytics AC (see `analytics`).
  - User-owned data or token/sign-in flows with no audit, authorisation or expiry AC.
  - New or changed journey with no note about updating journey tests.

## Step 4 — Report

Use exactly this structure. Omit any section with no findings (don't write "Pass" for it), except Prototype links, which always gets its one-line status; list the omitted sections on the last line.

```
## <KEY> — <summary>
Compared with: <keys scanned, comma-separated>   (note any skipped or unfetchable)

### Prototype links
- All prototype links are dev-ready.   (or, if not: <url or label> — <why not dev-ready>)

### Testability
- [**Blocker** — ]<Scenario n title> — <why, in a few words>. Suggest: <fix>

### Duplication
- <where> — <what repeats>. Suggest: <cut / merge>

### Page URLs
- Remove: <url> — <why>
- <Scenario n title> — application URL in AC; use page title "<title>" and keep URL in page URLs only
- [**Blocker** — ]Missing: <page> — <why needed>

### Redundancy
- <section> — remove (<reason>)

### Consistency with related tickets
- [**Blocker** — ]<KEY> — <inconsistency>

### Other
- [**Blocker** — ]<one-liner>

Verdict: <Fail (n blockers) | Pass with comments | Pass>. Nothing to report for: <omitted sections>.
```

Mark a finding **Blocker** (the bracketed prefix above, in any section) only where a developer or tester cannot work from the story as written, and list blockers first within each section. Everything else is untagged.

Verdict: `Fail` if any blockers; `Pass with comments` if findings but no blockers; `Pass` only if there are no findings other than the Prototype links status line.

Do not add a summary table, a per-check pass list, or any text beyond this structure. Keep each finding to one line of roughly 20 words or fewer; cut explanations the reader can infer. If a section has more than 10 findings, list the 10 most important and add "+N more".
