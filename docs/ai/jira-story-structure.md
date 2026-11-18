# Jira page story structure

The authoritative structure for any Jira story about a single journey page (`question page`, `content page`, `check your answers page`, `dropout page` or `confirmation page`), however it was written. `write-jira-story-from-prototype` produces it, `review-jira-story-from-prototype` checks it and `journey-page` / `journey-page-builder` parse it, so keep them in step with this file.

Stories using Given/When/Then are not supported. Ask the user to convert them to this format (for example by running `write-jira-story-from-prototype` on the story's prototype URL).

## Description

Jira wiki markup, in this order. Omitted sections are omitted, not empty.

| Element             | Expected                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| User story          | Three lines: `*As a*`, `*I want*`, `*So that*`                                                                                                       |
| Page type           | Directly below the user story: `*Page type*: question page`. Always bold label and a colon                                                           |
| Acceptance criteria | `h2. Acceptance criteria`, then a numbered list (`#`) of single-line items: `# *<Prefix>:* <one sentence>.`                                          |
| Page URLs           | `h2. Page URLs`, a two-column table (page title, URL). This page is the first row, followed by every other page named in an AC. No prototype column |
| Out of scope        | `h2. Out of scope`, only if it has content                                                                                                           |
| NFRs                | `h2. Non-functional requirements`, at least one bullet                                                                                               |
| Testing notes       | Optional `h2. Testing notes` after the NFRs: test users and data, how to reach a state, how to test what a browser can't. See [ac-testability.md](ac-testability.md) |
| Feature specification | Optional final line, `*Feature specification*: [+<title>+\|<url>]`                                                                                 |

No Notes, Context, "Generated from", separate Prototype line or Given/When/Then.

## AC prefixes

The bold prefix is the only thing parsers and reviewers rely on, so use exactly these forms. `<option>`, `<page title>`, `<row label>` and `<link name>` are filled in; everything else is literal.

| Prefix                                  | Page types                              | Meaning                                                                                                   |
| --------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `Page content`                          | all                                     | Heading and content match the prototype (the AC links it)                                                 |
| `Back link`                             | all except confirmation                 | Destination of the back link                                                                              |
| `Back link (from <entry point>)`        | as above                                | One per entry point, when the destination varies                                                          |
| `<link name> link`                      | all                                     | A content link in the page body, e.g. `Learn more link`. Always ends ` link`; never `Back link` or `Change link` |
| `Next page`                             | question, content, check your answers   | The only destination after Continue / submit                                                              |
| `Next page (if <option> selected)`      | question                                | One per distinct outcome of radios, checkboxes or conditional routing                                     |
| `Form validation (missing value)`       | question, check your answers            | Empty submission; links the `?preview=1&error=1` prototype state. A descriptive name for the same case, e.g. `(checkbox not ticked)` or `(no option selected)`, is equivalent and allowed |
| `Form validation (invalid format)`      | question, text input                    | The value is in the wrong format; links `?preview=1&error=format`                                         |
| `Form validation (<other validation>)`  | question                                | Any other reachable error, named in lower case, e.g. `(too long)`, `(out of range)`                       |
| `Show saved selection`                  | question                                | Returning to the page re-shows the saved answer                                                           |
| `Change link (<row label>)`             | check your answers                      | One per summary row, in page order                                                                        |
| `Entry point (from <page title>)`       | confirmation                            | One per page whose submission leads here                                                                  |
| `Browser back`                          | confirmation                            | Where the browser back button redirects                                                                   |

Do not invent other spellings (`Form validation (empty)`, `Back-link`, `Next page - Yes`). A scenario with no matching prefix is a wording finding in review, and a builder reports it as unclassified.

## Scenarios per page type

| Page type            | Scenarios, in order                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| question page        | Page content, Back link, content links, Next page, Form validation, Show saved selection                         |
| content page         | Page content, Back link, content links, Next page                                                                |
| check your answers   | Page content, Back link, Change links, content links, Next page                                                  |
| dropout page         | Page content, Back link, content links                                                                           |
| confirmation page    | Page content, Entry points, Browser back, content links                                                          |

An altered page includes only the scenarios the change affects.

## Rules for every AC

- Name other pages by title in italics (`_Title_`), exactly as the h1 appears in the prototype. Never use routes in an AC; routes live in Page URLs.
- Don't copy content strings (headings, hints, labels, error text) from the prototype; link to it. Page titles are the exception.
- One behaviour per AC, and each AC names where a tester sees the result.
- External destinations are a full link, open in a new tab (say so), and are not in Page URLs.

The writer's full workflow is in [write-jira-story-from-prototype](../../.ai/skills/write-jira-story-from-prototype/SKILL.md); testability rules are in [ac-testability.md](ac-testability.md).
