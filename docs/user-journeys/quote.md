# Create a quote (drawn boundary)

http://localhost:3000


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
    2. Open the Styles panel and switch to "Satellite"
    3. Focus the Draw button and press Enter; wait for the Cancel button to confirm drawing mode is active
    4. Press Enter to place the first vertex; press ArrowRight ~15 times then Enter for the second; press ArrowDown ~15 times then Enter for the third; wait for the Done button to become enabled (aria-disabled removed)
    5. Click Done — the boundary information panel should appear showing Area, Perimeter, and the EDP the boundary falls within
    6. Open the Draw tools menu and click "Edit feature"; move a vertex by pressing an arrow key ~5 times then Enter; wait for the Done button to become enabled; click Done — boundary info panel should update
    7. Open the Draw tools menu and click "Delete feature" — the shape should be removed and the boundary information panel should clear
    8. Focus the Draw button and press Enter; draw another triangle (same technique as step 4); click Done — boundary information panel should appear again
    9. Click Save and continue (use waitUntil: 'commit' when waiting for the next URL)
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
