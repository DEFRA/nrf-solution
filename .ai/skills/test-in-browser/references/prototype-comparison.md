# Prototype comparison

Applies when any acceptance criterion links to a prototype page or prototype error state (e.g. "content should match the prototype", "error summary as shown on the prototype error state").

**Use the `util-browse-prototype` skill to get the expected content. Do not navigate to prototype URLs yourself.** The prototype is password-protected; `util-browse-prototype` handles the password prompt using the `PROTOTYPE_PASSWORD` env var and extracts the page with the project's extraction script. Never ask the user for the password or paste it into the conversation.

- Run it once per linked prototype URL during Setup, before testing scenarios, because it drives the same Playwright browser. Hold the extracted JSON in memory, then navigate back to the test URL.
- For error-state criteria, ask it to capture the error state (its Step 3). The error summary link text is the source of truth for expected error wording.
- Compare the deployed page against the extracted heading, body content, radio/checkbox labels and values, hints, button text and error wording. The extraction script skips the back link, per-item hints, inset text, warning text, tables, lists and details: check those against the prototype's DOM in the browser.
- Differences that don't affect what a user sees (e.g. error summary anchor `href` casing, the back link's route) are not failures; mention them in the Notes column.
- Never fetch the prototype with `curl` or your own scripts. Use only `util-browse-prototype`, which drives the browser and logs in with `PROTOTYPE_PASSWORD`.
- If `util-browse-prototype` fails (e.g. `PROTOTYPE_PASSWORD` is unset), report the exact error and mark prototype-dependent scenarios ⚠️ Partial, with the reason in Notes. Don't guess the expected content.
