# Boundary is not in an EDP

https://nrf-frontend.test.cdp-int.defra.cloud

1. Start page - skip
2. Planning application type
   1. Submit with no option selected
   2. Select Full planning permission
3. Are you developing housing units?
   1. Submit with no option selected
   2. Select Yes
4. How many residential units in this development?
   1. Submit with no option selected
   2. Submit with valid number
5. Boundary type
   1. Submit with no option selected
   2. Select Upload a file
6. Upload a red line boundary file
   1. Choose file (journey-tests/test/fixtures/no_edp_intersection.geojson)
7. Boundary file upload status
   1. Wait until file has been scanned and page redirects automatically
8. Boundary Map
   1. Save and continue
9. Nature Restoration Fund levy is not available in this area
