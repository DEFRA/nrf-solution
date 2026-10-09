# Jira story structure

For user interface development stories:

| Element             | Expected                                                                          |
|---------------------|-----------------------------------------------------------------------------------|
| Generated from      | `*Generated from*:` followed by a `[+…+\|url]` link to the Confluence source page |
| User need           | Three lines: `*As a* [user type]`, `*I want* …`, `*So that* …` — no `*User need*:` prefix |
| Page type           | `*Page type*:` line — `question page`, `dropout page` or `confirmation page`       |
| Prototype link      | A bare `[+Prototype+\|url]` line                                                  |
| Page URLs section   | `h2. Page URLs` with one bullet per page: `* *<page name> (this page):*`, `* *<page name> (previous page):*` (one per distinct previous-page destination; omit entirely if the page never has a back link), `* *<page name> (next page):*` (one per distinct next-page destination; omit for a `dropout page` or `confirmation page`, which are dead ends). A `confirmation page` has no back link, so its previous-page bullet is the page the user submits from (the entry point). `<page name>` is the exact h1 captured from the prototype for that page |
| Acceptance criteria | `h2. Acceptance criteria`                                                         |
| Scenarios           | At least one `h3. Scenario N - <summary>` heading under the AC section, where `<summary>` is a short plain-text phrase (no markup) on the same line |
| Step keywords       | Every scenario uses `*Given*`, `*When*`, `*Then*` (Jira bold markup)              |
| Content links       | Only if the spec has a `Content link` (single) or `Content links` (bulleted list) entry: one scenario per link (`Given` on this page, `When` I select the link, `Then` I am taken to the path or URL from the spec). The destination is stated in the scenario, not added to Page URLs |
| Dropout page        | Only entry-point, back-link and content-link scenarios — no happy path or error scenarios, no next-page bullet, no Security NFR |
| Confirmation page   | Only entry-point, browser-back and content-link scenarios — no back link scenario, no happy path or error scenarios, no next-page bullet, no Security NFR. The browser-back scenario's `Then` is `I am redirected to <path or URL from the spec>`, stated directly and not added to Page URLs |
| Out of scope        | Optional, if anything was defined in the confluence page                          |
| NFRs                | `h2. Non-functional requirements` with at least one bullet                        |
| Journey tests note  | Final element of the description, after the NFRs: `h2. Testing notes` followed by the bullet `* Update the journey tests to include the new page`. Always present, for every page type |


```
*Generated from*: [+Confluence page title+|url] on [date] at [time]

----

*As a* [user type]
*I want* …
*So that* …

*Page type*: question page | dropout page | confirmation page

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

----

h2. Testing notes

* Update the journey tests to include the new page
```
