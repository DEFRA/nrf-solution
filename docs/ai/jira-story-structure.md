# Jira story structure

For user interface development stories:

| Element             | Expected                                                                          |
|---------------------|-----------------------------------------------------------------------------------|
| Generated from      | `*Generated from*:` followed by a `[+…+\|url]` link to the Confluence source page |
| User need           | Three lines: `As a [user type]`, `I want …`, `So that …` — no `*User need*:` prefix |
| Page type           | `*Page type*:` line                                                               |
| Prototype link      | A bare `[+Prototype+\|url]` line                                                  |
| URLs section        | `h2. URLs` with `* *This page*:`, `* *Next page*:` and optionally `* *Back link*:` (one entry per distinct destination; omit if the page has no back link) |
| Acceptance criteria | `h2. Acceptance criteria`                                                         |
| Scenarios           | At least one `h3. Scenario N` subheading under the AC section, followed by a one-line plain-text summary of what the scenario tests |
| Step keywords       | Every scenario uses `*Given*`, `*When*`, `*Then*` (Jira bold markup)              |
| Out of scope        | Optional, if anything was defined in the confluence page                          |
| NFRs                | `h2. Non-functional requirements` with at least one bullet                        |


```
*Generated from*: [+Confluence page title+|url] on [date] at [time]

----

As a [user type]
I want …
So that …

*Page type*: question page

[+Prototype+|url]

----

h2. URLs

* *This page:* /route/from/spec
* *Back link:* /back-link/destination
* *Next page:* /route/of/next/page

----

h2. Out of scope

* …

----

h2. Acceptance criteria

h3. Scenario 1
[one-line summary of what this scenario tests]

*Given* …
*When* …
*Then* …

----

h2. Non-functional requirements

[NFR bullets]
```
