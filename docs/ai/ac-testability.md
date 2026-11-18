# AC testability and distinctness

Shared rules for reviewing a single-line bold-label numbered acceptance criterion (the simplified
format: `# *<Prefix>:* <sentence>`, no Given/When/Then). Used by `review-jira-story` and
`review-jira-story-from-prototype` so the same AC is judged the same way regardless of which story
it's written. Written for `test-in-browser`: every AC it describes must give that skill one
pass/fail condition it can check from the browser, the network, an email or the database.

## Testability

Flag an AC if it fails any of these, and say why in a few words, with a suggested fix where
obvious:

- **No concrete target.** The sentence doesn't name where a tester sees the result — a page
  (by title), content via a prototype link, a network/endpoint response, an email, or a database
  record. "Is handled", "is recalculated", "is refused", "is stored" are not enough on their own;
  name the output and, where there's a calculation or rule, give a worked example value.
- **Too generic to pin down one pass/fail condition** — `the correct behaviour occurs`, `an
  appropriate error is shown`, `the user is taken to the right page`.
- **Mixes more than one behaviour.** "Or" joining two triggers, pages or outcomes in one AC; a
  slash standing in for a word; an ambiguous "it" that could mean either of two things just
  mentioned. Suggest splitting into separate numbered ACs.
- **Needs a state the story never explains how to reach** — a `Given`-style precondition with no
  AC or linked ticket that creates it.
- **Placeholder or unfilled template text** — `[url]`, `[page name]`, `TBD`, `TODO`, `?`.
- **Visible UI or email copy quoted inline** rather than linked to a prototype or referenced by
  page title in italics.
- **Indirect reference that forces the reader elsewhere** — "the fields listed in the Context".
  Move the detail into the AC itself.
- **Implementation detail that isn't needed to verify the outcome** — database/table names, which
  service or store holds data, endpoint internals, column names. Reword to the observable
  behaviour; move anything a tester genuinely needs into Notes or the dev task.

## Distinctness

Compare every pair of ACs in the ticket, not just each one alone:

- Flag a pair where nothing in the two sentences would tell you which one broke if the underlying
  behaviour failed — identical outcome worded two ways, or one AC that's a strict subset of
  another's condition.
- When flagging an overlap, quote both bold-label prefixes and say whether to merge them into one
  AC or add an explicit distinguishing condition (a different input value, option, or starting
  state).

Wording problems contained within a single AC belong to testability above, not here.
