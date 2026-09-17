---
name: jira-story-reviewer
description: Reviews a Jira story for completeness, testability, and compliance with jira-story-writer conventions
---

## Parameters

`args` is a Jira ticket reference (e.g. `NRF2-1185`) or full URL (e.g. `https://eaflood.atlassian.net/browse/NRF2-1185`). If given a reference, resolve it to `https://eaflood.atlassian.net/browse/<reference>` before proceeding.


## Steps

### Step 1 — Fetch the ticket

Use `read-jira-ticket` with the ticket ID. Work from the raw description text returned.

### Step 2 — Run all checks

Run every check below in full. Collect all findings before reporting — do not stop at the first issue.

---

#### Check A — Required sections present

The description must contain all of the following, in order:

| Element | Expected |
|---|---|
| Feature | `*Feature*:` followed by a `[+…+\|url]` link |
| User need | `*User need*:` followed by an "As a … I want … so that …" statement |
| Page type | `*Page type*:` line |
| Prototype link | A bare `[+Prototype+\|url]` line |
| URLs section | `h2. URLs` with at minimum a `* *This page*:` bullet |
| Acceptance criteria | `h2. Acceptance criteria` |
| Scenarios | At least one `h3. Scenario N` subheading under the AC section |
| Step keywords | Every scenario uses `*Given*`, `*When*`, `*Then*` (Jira bold markup) |
| NFRs | `h2. Non-functional requirements` with at least one bullet |

Flag any element that is missing or malformed.

---

#### Check B — No inline content strings

Content strings (h1 headings, hint text, button labels, error messages) must never appear inline in the description. They must only be referenced via a prototype link.

Flag any AC step or other field that:
- Quotes a visible UI string verbatim (e.g. copies an error message or button label in full)
- Uses quoted wording that looks like it was lifted from the page (e.g. `"Enter your NRL reference"`)

**Allowed:** referring to a page by name without quotes as a navigational reference (e.g. `Given I am on the enter NRL reference page`).

**Allowed:** the `*User need*:` field containing the full "As a …" statement — this is metadata from the spec, not a UI content string.

**Required for error states:** error outcomes must link to `prototype-url?preview=1&error=1`, not to the base prototype URL and not inline text.

---

#### Check C — AC testability

For each scenario, verify:

1. **Starting URL is resolvable** — if the `Given` clause says the user is on a named page, that page's URL must appear under `h2. URLs → *This page*:`, `*Back link*:`, or `*Next page*:`. Flag it if the URL cannot be determined from the URLs section alone.
2. **Outcome URL is resolvable** — if the `Then` clause says the user is taken to another page, that destination must also appear in the URLs section. Flag any `Then` step that names a destination whose URL is not listed.
3. **No ambiguous placeholders** — steps must not contain `[url]`, `[page name]`, `[prototype-url]`, or any other unfilled placeholder. Prototype links must be real URLs.
4. **Error-state ACs link to the prototype error state** — `Then` steps describing an error outcome must link to the prototype URL with `?preview=1&error=1` appended (e.g. `[prototype error state|https://…?preview=1&error=1]`). Flag any error-state `Then` step that quotes error text inline or links to the prototype without the query string.

---

#### Check D — NFR completeness

The four baseline categories must all be present unless the ticket is clearly out of scope for one (e.g. an internal admin-only page). For a `question page` all four apply. Flag any missing baseline category:

- Accessibility
- Browser & device compatibility
- Page load performance
- Security

---

### Step 3 — Report

Return a structured report with one section per check. For each check, list:

- **Pass** — if no issues found
- **Finding:** [description] — for each issue, with the relevant excerpt from the ticket

End with a one-line overall verdict: **Pass** (no findings) or **Fail** (N findings).
