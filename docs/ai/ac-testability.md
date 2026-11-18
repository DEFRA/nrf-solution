# AC testability and distinctness

Shared rules for writing and reviewing a single-line bold-label numbered acceptance criterion (the simplified
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
  behaviour; move anything a tester genuinely needs into Testing notes.
- **Content or error state with no prototype link.** An AC about page content, a message or an
  error state links the prototype URL that shows that state (e.g. `?preview=1&error=1`), rather
  than quoting the text.
- **Page named in an AC with no Page URLs row.** Every page an AC names or visits (back link,
  next page, content link, entry point) has a row under `h2. Page URLs`, and every row other than
  the story's own page is named in an AC. Applies to any story that names a page.

## Testing notes

Anything `test-in-browser` needs that doesn't belong in an AC goes under a final
`h2. Testing notes` section (after the NFRs), as bullets, so the ACs stay short. This applies to
every story, not just page stories. Include:

- **Test data and accounts** — e.g. the Defra ID test user (or which user type) needed to sign in,
  an NRL reference, or an email address to use. Name the user from the
  [Test users (non-prod)](https://eaflood.atlassian.net/wiki/spaces/NRFDT/pages/6575620298/Test+users+non-prod)
  Confluence page and link to it; don't copy credentials into the ticket.
- **How to reach a state** — preconditions the ACs depend on that a tester can't reach by
  following the ACs.
- **How to test what a browser can't** — for an API, calculation, email or data change, say how
  to exercise it (the request to send, the expected response, where to check the email or
  record), with a worked example value.
- **Journey tests** — a bullet naming the journey tests to add or update, where they are affected.

Flag an AC that needs any of these but has no matching Testing notes bullet. Flag a Testing notes
bullet that restates an AC or states expected behaviour that no AC asserts (put the behaviour in
an AC). Don't put secrets or real credentials in a ticket; point to where the tester finds them.

## Distinctness

Compare every pair of ACs in the ticket, not just each one alone:

- Flag a pair where nothing in the two sentences would tell you which one broke if the underlying
  behaviour failed — identical outcome worded two ways, or one AC that's a strict subset of
  another's condition.
- When flagging an overlap, quote both bold-label prefixes and say whether to merge them into one
  AC or add an explicit distinguishing condition (a different input value, option, or starting
  state).

Wording problems contained within a single AC belong to testability above, not here.
