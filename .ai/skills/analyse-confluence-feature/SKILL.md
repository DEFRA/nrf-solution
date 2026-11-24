---
name: analyse-confluence-feature
description: Review a Confluence feature spec against the team's spec standards (structured by subheading, concise, no duplication, unambiguous, Out of scope clearly separated, Implementation notes separate, every page linked to a dev-ready /handoffs prototype), cross-check it with the prototype and domain knowledge, and report issues with suggested fixes. Creates a child copy of the page, rewrites it to fix the issues, and returns its URL with a short report of the points the rewrite did not action for tweaks; never edits the original. Writes no Jira tickets. TRIGGER before writing stories for any multi-page, multi-variant or multi-flow feature, or when asked to review or tidy a feature spec. For a single simple journey page use write-jira-story-from-prototype directly.
allowed-tools: Read, Bash
model: inherit
skills:
  - util-read-confluence-page
  - util-browse-prototype
  - util-read-jira-ticket
---

You make sure a Confluence feature spec meets the standards below, so it can be built from without guesswork. The output is the analysis results: a short list of issues in the spec (places it falls short of the standards or can't be built from), each with its fix. How to split the work into Jira stories is out of scope: it depends on the existing implementation and is the team's decision. You never create or update Jira tickets.

Be concise. State each fact once, in the section it belongs to. Every issue and fix is one or two lines.

## Prerequisites

`ATLASSIAN_USER` and `ATLASSIAN_TOKEN` must be set ([atlassian-credentials.md](../../../docs/ai/atlassian-credentials.md)). Input: the Confluence feature page (URL or ID) and anything the user already knows. If a script fails, stop and report the exact error.

## Spec standards

The spec itself is the source of truth. Report each deviation as an issue.

- **Structured:** a subheading per piece of functionality (e.g. the check, the dropout, the confirmation), each self-contained. Lower-level subheadings (`####`) are fine to break a section down further. Aim for content that is easy to scan: one concept per heading. A single generic heading such as "Description" that wraps the whole body is an issue: remove it and use meaningful subheadings instead.
- **Concise, no duplication:** each rule stated once, in the section it belongs to.
- **Unambiguous:** every trigger, condition, user type, return route, figure and data source is stated. Nothing is left to "it depends" or implied (e.g. which action runs a check; where a back link goes from each entry point). Name a back link or return route by page title, never a URL: the built URLs live in the app, not the prototype, so you can't determine them.
- **No "Decision" prefix:** everything in the spec is a decision, so a "Decision:" prefix on a paragraph or sentence is redundant. Search case-insensitively (also "DECISION"), remove the prefix and keep the text.
- **Out of scope separated:** one "Out of scope" subheading collecting everything not being built, each item with its owning feature or ticket where there is one. Notes about other features, accepted limitations and future work do not sit in the functional description.
- **Implementation notes separate:** an "Implementation notes" section at the end for how it might be built (data placement, backend vs frontend, tables). Implementation detail in the body is an issue: move it there. It is guidance, not requirements.
- **Prototype links:** every UI page this feature owns is referenced with a link labelled exactly `(prototype)` whose path begins `/handoffs`. The literal label shows the link is a prototype, not a Jira ticket or another spec. Any other prototype link is not dev-ready and is an issue. Pages the spec only references, because another feature spec owns them, need no `(prototype)` link. Where the build will differ from the prototype (e.g. three prototype pages for one dynamic route that varies by user type), the spec says so beside the reference. Never infer the built route from the prototype.
- **Prototype is the only content source:** no links to Mural or other design boards. Replace with the `(prototype)` link, or if the prototype lacks the content, flag the mismatch for the BA.
- **All comments resolved:** no open footer or inline comments. Each open comment is an issue: either its answer is in the body and it can be resolved, or it is an open question that blocks readiness. A spec isn't ready while any comment is open.
- **Jira links inline,** beside the behaviour they relate to with a few words on what the ticket is, not collected at the top.

## Workflow

1. **Gate.** Read the page (`util-read-confluence-page`). Every UI page this feature owns (not pages only referenced, which belong to other feature specs) needs a dev-ready `(prototype)` link. Stop only if you are sure the spec refers to a UI page that lacks one: list the missing pages and do no further analysis. Some features have no UI (rare, e.g. backend or calculation work); if the spec describes no UI pages, there is nothing to gate on, so continue. If unsure whether a referenced thing is a UI page, don't stop: continue and raise it as an issue.
2. **Ingest.** Resolve every Jira link on the page, and any ticket the comments mention, with `util-read-jira-ticket` (summary only, don't follow its links). You need each summary to place the link inline. Do not skip this step. Don't read linked Confluence pages unless an issue can't be settled without one. Also list the page's comments with `node .ai/skills/tools/confluence/comments.mjs PAGE_ID`: they often hold clarifications the body doesn't yet reflect, and any with status other than `resolved` fails the readiness standard.
3. **Cross-reference.** Always invoke the `util-browse-prototype` skill for every prototype page the spec references, never `curl`, WebFetch or any other substitute (prototype pages need JavaScript and may need a password). Its Playwright tools are deferred: load them with ToolSearch first. Never report a prototype page as unloadable without having run the skill and quoted its error. Walk each state the spec describes (user types, change links and return routes, back links, error and dropout states, confirmation). Record h1s only. Use repo and domain knowledge where relevant: `defra-id-auth`, `frontend-session-data`, and existing routes under `frontend/src/server/`.
4. **Issues.** Check the spec against the standards above, plus: spec and prototype disagree; behaviour undefined; `#` or missing link destinations; built-route questions (e.g. "one route varying by X?"). One line each, naming the spec section.
5. **Fixes.** For each issue, the concrete change to the spec, in the same line as the issue. Where the answer isn't known, list it under Open comments instead of inventing one. Word each so the BA can answer it from the spec and prototype alone, without build knowledge.
6. **Copy, rewrite, report.** Once the analysis is done, do all of this without asking, on a child copy and never on the original page:

   ```bash
   node .ai/skills/tools/confluence/copy-page.mjs PAGE_ID        # prints: NEW_ID URL
   node .ai/skills/tools/confluence/patch-page.mjs NEW_ID -      # edits JSON on stdin; dry run, then add --apply
   node .ai/skills/tools/confluence/copy-comments.mjs PAGE_ID NEW_ID COMMENT_ID[=ANCHOR]...   # re-ask open comments on the copy
   ```

   1. Create the copy. It is titled `[ANALYSIS COPY] <title>` (numbered `[ANALYSIS COPY 2]`, `3`, ... when earlier copies exist, so it never clashes) and sits under the original, so it is easy to find and deleting it discards everything.
   2. Rewrite the copy to fix every issue whose fix is known. This is a full restructure of the body, not a few small string patches: replace the whole body text (everything after the top note panel and Jira macro) in one or a few large edits, keeping the panel and macro. Remove a generic "Description" heading rather than keeping it above the new subheadings. Rewrite it in this shape:
      - A `##` subheading per piece of functionality (e.g. the check, the dropout, what the check does not do), each self-contained, with `###` or `####` subheadings where a section has distinct concepts (e.g. triggers, outcomes, edge cases), so each concept is easy to scan. Then `Out of scope`, then `Implementation notes` if there are any.
      - Under each subheading, first a line `Jira: <key link> (a few words on what the ticket covers)`, using the summaries from step 2. Never leave Jira links collected at the top.
      - Triggers and outcomes as short bullets (e.g. "Enough capacity: the user continues to *Page title*"), not prose paragraphs.
      - Every page the spec refers to is written in italics by its page title (e.g. *Review and amend your quote details*), with `(prototype)` after owned pages. Back links and return routes name the page, never a URL.
      - Merge paragraphs that restate the same rule into one section. Remove "Decision:" prefixes, Mural links and non-`/handoffs` links. Each Out of scope bullet names its owning ticket or page.
      - Keep inline comment anchors only where the commented words survive unchanged; the rewritten text does not need to preserve the rest.
      Read the copy's storage body (`util-read-confluence-page NEW_ID storage`), build `[{"before","after"}]`, dry-run `patch-page.mjs`, then re-run with `--apply`. Each `before` must occur exactly once; fix the edit rather than loosen it. Never invent content for open comments: leave that text as it is. Before reporting, re-read the copy and check it has the subheadings above; if it is still one block of prose, or a generic "Description" heading remains, the rewrite is not done.
   3. Go through every open comment from `comments.mjs` one by one and record whether the rewrite actioned it or it is re-asked: none may be left unaccounted for. Re-ask the open comments the rewrite did not action, with `copy-comments.mjs` (top-level comment IDs from `comments.mjs`). Skip resolved comments and any open comment the rewrite already actioned (e.g. "move to Out of scope"). Re-ask those that cannot be actioned until answered (e.g. "could state the number"). Each is prefixed with its original author and date, highlighted in the body. An inline comment keeps its original text if that still occurs exactly once; if the rewrite changed it, pass `COMMENT_ID=ANCHOR` with the rewritten words it now relates to (exactly once in the copy). Only if none fits does it become a footer comment quoting the original text. Footer originals are re-asked as footer comments.
   4. **Verify no information loss.** This is the final step before replying, and it is crucial: the original was written by a team member, and the rewrite must not distort or lose any of their facts. Read the original (`util-read-confluence-page PAGE_ID`) and the finished copy (`util-read-confluence-page NEW_ID`) back through in full, line by line, not skimming. For every sentence, bullet, figure, name, condition, trigger, user type, return route, link, table row and Jira reference in the original, find where it now lives in the copy, or the deliberate reason it is gone (a "Decision:" prefix, a Mural or non-`/handoffs` link replaced by `(prototype)`, a duplicate merged into its twin, a generic heading removed, or an item moved to Out of scope or Implementation notes). Check specifically that:
      - no fact, number, threshold, name, condition or exception is dropped, softened, strengthened or reworded to a different meaning (e.g. "may" became "must", "or" became "and", a scope narrowed or widened);
      - merged paragraphs keep every distinct point from each source paragraph;
      - nothing moved to Out of scope or Implementation notes changed meaning in the move, and nothing in scope was moved out (or the reverse);
      - every Jira link and its ticket relationship survives, and each is still placed beside the behaviour it relates to;
      - every page reference keeps the same page and the same entry, return or back-link behaviour.

      Fix any loss or distortion in the copy with the same dry-run and `--apply` steps, then repeat this read-back until a full pass finds nothing. If the original is ambiguous and the rewrite had to choose a meaning, restore the original wording and raise it as an open question instead. Never report the copy as done while any difference is unaccounted for. In the report, state in one line that the read-back was done and list any deliberate removals or moves.
   5. Reply with the copy's URL and the report (see Report). Never post the report as a comment on the copy. Comments are not copied by Confluence, so the originals stay on the original page, and the re-asked ones are copies for the BA to answer.

   The copy is a draft for the user to review, not an approved spec. Wait for the user's tweaks, then apply them to the copy with the same dry-run and `--apply` steps. If they don't want the changes, they delete the copy. Never edit the original.

## Report

Keep it short. No preamble, no restating the spec, no commentary on what passed.

- **Rewritten on the page copy:** a short bullet list of what the rewrite changed, one line each.
- **Read-back:** one line confirming the original and copy were compared in full, plus any deliberate removals or moves.
- **Then only the points the rewrite did not action** (open questions, prototype mismatches, anything the BA must decide), as the sections below.
- **Issues:** one bullet each, in the form `Section: problem -> fix`, max ~20 words. Merge issues with the same fix (e.g. all Out of scope moves in one bullet; all open comments answered by an edit in one bullet, citing the edit). Group under the standard they breach only if that shortens it.
- **Open comments:** one line each. Only questions the spec can't answer.
- **Not checked:** one line.
