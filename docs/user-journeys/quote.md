# Create a quote (drawn boundary)

## Map page conventions

The interactive map requires keyboard navigation for drawing. Many map buttons have zero bounding-box dimensions and **must be activated via `.evaluate(el => el.click())`** — Playwright's standard `locator.click()` times out on them.

| Interaction | How to target |
|---|---|
| Open search panel | `getByRole('button', { name: 'Search', exact: true })` → `.evaluate(el => el.click())` |
| Search input | `getByRole('combobox', { name: 'Search' })` → `pressSequentially(query)` |
| Select a search result | `getByRole('option', { name: /^Aylsham(,|$)/i }).first()` → wait for visible → `.click()` |
| Key panel | `getByRole('button', { name: 'Key', exact: true })` |
| Start drawing | `getByRole('button', { name: 'Draw', exact: true })` → `.focus()` → `keyboard.press('Enter')`; wait for Cancel button to confirm drawing mode |
| Place a vertex | `keyboard.press('Enter')` |
| Pan between vertices | Arrow keys (~15 presses between points) |
| Done button | `getByRole('button', { name: 'Done' }).and(locator(':not([aria-disabled="true"])'))` — `aria-disabled="true"` is present until ≥3 distinct spaced vertices; wait for it to be absent before clicking |
| Save and continue (map/file-preview) | `.evaluate(el => el.click())` then `waitForURL(/\/quote\/.../, { waitUntil: 'commit' })` — `locator.click()` times out here because lingering tile fetches hold the load event |
| Back (map page only) | `getByRole('button', { name: 'Back' })` — this is a `<button>`, not a link |
| Back (all other pages) | `getByRole('link', { name: 'Back', exact: true })` — `exact: true` avoids matching "give your feedback" in the phase banner |

### checking-file auto-redirect

The checking-file page polls the server and redirects client-side. `waitForURL` and `waitForFunction` both time out even though the redirect succeeds. After clicking Continue on the upload page, use a fixed wait then read `page.url()` directly to confirm where you landed:

```js
await page.getByRole('button', { name: 'Continue' }).click()
await page.waitForTimeout(500) // let checking-file appear
await page.waitForTimeout(15000) // allow scan + redirect to complete
const url = page.url() // verify expected destination
```

### Housing units input

The unit-number input does not carry a `spinbutton` ARIA role. Target it by ID: `page.locator('#housingUnits')`.

---

1. Start page
    1. Click View cookies
2. Cookies on Nature Restoration Levy
    1. Click "Save cookie settings" without selecting an option first
    2. Select "Yes" then "Save cookie settings"
    3. Select "Go back to the previous page"
3. Planning application type
   1. Submit with no option selected
   2. Submit with Other option selected
4. Nature restoration levy is not currently available for this planning application type
    1. Select Back
5. Planning application type
   1. Select Full planning permission
6. Are you developing housing units?
   1. Submit with no option selected
   2. Select No
7. Nature restoration levy is only available for housing units
   1. Select Back
8. Are you developing housing units?
    1. Select Yes
9. How many residential units in this development?
   1. Submit with no value entered
   2. Submit with -1 entered
   3. Submit with 0.1 entered
   4. Submit with valid number
10. Boundary type
    1. Submit with no option selected
    2. Select Draw on a map
11. Map page
    1. Open the search panel (Search button), type "Aylsham", wait for and click the option whose text starts with "Aylsham,"
    2. Focus the Draw button and press Enter; wait for the Cancel button to confirm drawing mode is active
    3. Press Enter to place the first vertex; press ArrowRight ~15 times then Enter for the second; press ArrowDown ~15 times then Enter for the third; wait for the Done button to become enabled (aria-disabled removed)
    4. Click Done — the boundary information panel should appear showing Area, Perimeter, and the EDP the boundary falls within
    5. Click Save and continue (use waitUntil: 'commit' when waiting for the next URL)
12. Enter email address
    1. Submit with no option selected
    2. Submit with valid email
13. Check your answers
    1. Select "Change drawn red line boundary" — this goes directly to the Boundary type page (not back to the map)
14. Boundary type
     1. Select Upload a file
15. Upload a red line boundary file
    1. Choose file (journey-tests/test/fixtures/no_edp_intersection.geojson)
16. Boundary file upload status
     1. Wait until file has been scanned and page redirects automatically
17. Nature restoration levy is not available in this area
     1. Select Back
18. Upload a red line boundary file
    1. Choose file (journey-tests/test/fixtures/excluded_area.geojson)
19. Boundary file upload status
    1. Wait until file has been scanned and page redirects automatically
20. Development is within the excluded area of this Environmental Delivery Plan (EDP)
    1. Select Back
21. Upload a red line boundary file
    1. Choose file (journey-tests/test/fixtures/BnW_small_under_1_hectare.geojson)
22. Boundary file upload status
    1. Wait until file has been scanned and page redirects automatically
23. Your uploaded red line boundary file
    1. Select Save and continue
24. Enter email address
    1. Select Continue
25. Check your answers
    1. Click Delete
26. Are you sure you want to delete this quote?
    1. Select Cancel
27. Check your answers
    1. Select Confirm and submit
28. Confirmation page
