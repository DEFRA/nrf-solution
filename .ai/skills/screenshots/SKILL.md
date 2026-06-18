---
name: screenshots
description: Test a page in the browser against accessibility standards.
tools: Bash, Read, mcp__playwright__browser_navigate, mcp__playwright__browser_navigate_back, mcp__playwright__browser_snapshot, mcp__playwright__browser_evaluate, mcp__playwright__browser_run_code_unsafe, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_fill_form, mcp__playwright__browser_press_key, mcp__playwright__browser_wait_for, mcp__playwright__browser_close, mcp__playwright__browser_console_messages, mcp__playwright__browser_network_requests
---

# Screenshot User Journey

## Overview

This skill captures screenshots of all pages in a user journey by automatically walking through the user flow and taking screenshots of each page.

`args` is a path to a **journeys markdown file** (by default look in docs/user-journeys folder), or a single URL to a page to test.

Each numbered step within a journey is a separate page.

For each page, if there are specified sub-steps then execute each step. After the last step, continue to the next page.
If a page has "- skip" then just click through it and don't take a screenshot.

> **Setup:** when testing deployed environments (e.g. `*.cdp-int.defra.cloud`), add a real-browser `--user-agent` to your Playwright MCP server args in `~/.claude.json` — otherwise the bot filter serves blank pages to Playwright's headless UA. See `test-in-browser/SKILL.md` for the exact value.

## Flow

1. Read the journeys file from `args`.
2. For each journey:
    - Navigate to the journey's URL with `mcp__playwright__browser_navigate`.
    - For each page in order:
        - Confirm the expected page loaded via `mcp__playwright__browser_snapshot`.
        - If the page has sub-steps, perform each one in order, enter a form input if relevant then take a screenshot after each, unless the parent step has '- skip'
        - **Form pages with validation:** For each form page that has a validation error sub-step:
          1. Submit the empty form to trigger the validation error. Take a screenshot.
          2. Make a valid entry/selection and submit the form to proceed to the next page.
          3. Use browser back to return to the form page. Take a screenshot showing the valid entry pre-filled.
        - After the last sub-step, continue to the next page.
3. After all journeys, close the browser with `mcp__playwright__browser_close`.

If a sub-step can't be performed or a page doesn't load, record the failure and stop that journey — do not retry silently. Report the exact error. Continue with the next journey.

- Default viewport: 1200x800 pixels
- Full-page screenshots
- Network idle wait for page loads. For 'Map page' wait 10 seconds before taking the screenshot.

## Drawing on the map

Use keyboard-based drawing, not mouse clicks on the canvas (mouse events don't reliably register with the MapLibre GL draw library).

To draw a triangle:
1. Focus the Draw button and press Enter to activate draw mode. Wait for the Cancel button to appear.
2. Press Enter to place the first point at the current map centre.
3. Press ArrowRight 20 times, then Enter to place the second point.
4. Press ArrowDown 20 times, then Enter to place the third point.
5. Check that the Done button has `aria-disabled` removed. If not, add extra points (alternating ArrowLeft/ArrowUp, 20 presses each) until it enables.
6. Click Done. Wait up to 20 seconds for "Save and continue" to become enabled (boundary validation API call).

**Session integrity:** Always navigate through the full form flow from the start page in one continuous session. Never clear cookies mid-session — this invalidates the CSRF token and causes the boundary validation endpoint (`/quote/draw-boundary/check`) to return 403.

Use `mcp__playwright__browser_run_code_unsafe` for map interactions so the full Playwright API (keyboard, waitFor, etc.) is available in a single session context.

## Output format

.png screenshots should be saved to 'docs/user-journeys/screenshots/'. For a given run of this skill, create a new subfolder named yyyy-mm-dd-<journey file name>. The screenshots should be named 01-page-name.png, and the number incremented for each page.
