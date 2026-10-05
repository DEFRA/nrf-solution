# Jira story structure

For user interface development stories:

| Element             | Expected                                                                          |
|---------------------|-----------------------------------------------------------------------------------|
| Generated from      | `*Generated from*:` followed by a `[+…+\|url]` link to the Confluence source page |
| User need           | Three lines: `*As a* [user type]`, `*I want* …`, `*So that* …` — no `*User need*:` prefix |
| Page type           | `*Page type*:` line                                                               |
| Prototype link      | A bare `[+Prototype+\|url]` line                                                  |
| Page URLs section   | `h2. Page URLs` with one bullet per page: `* *<page name> (this page):*`, `* *<page name> (previous page):*` (one per distinct previous-page destination; omit entirely if the page never has a back link), `* *<page name> (next page):*` (one per distinct next-page destination). `<page name>` is the exact h1 captured from the prototype for that page |
| Acceptance criteria | `h2. Acceptance criteria`                                                         |
| Scenarios           | At least one `h3. Scenario N - <summary>` heading under the AC section, where `<summary>` is a short plain-text phrase (no markup) on the same line |
| Step keywords       | Every scenario uses `*Given*`, `*When*`, `*Then*` (Jira bold markup)              |
| Out of scope        | Optional, if anything was defined in the confluence page                          |
| NFRs                | `h2. Non-functional requirements` with at least one bullet                        |


```
*Generated from*: [+Confluence page title+|url] on [date] at [time]

----

*As a* [user type]
*I want* …
*So that* …

*Page type*: question page

[+Prototype+|url]

----

h2. Page URLs

* *[This page h1] (this page):* /route/from/spec
* *[Previous page h1] (previous page):* /back-link/destination
* *[Next page h1] (next page):* /route/of/next/page

----

h2. Out of scope

* …

----

h2. Acceptance criteria

h3. Scenario 1 - [summary of what this scenario tests]

*Given* …
*When* …
*Then* …

----

h2. Non-functional requirements

[NFR bullets]
```
