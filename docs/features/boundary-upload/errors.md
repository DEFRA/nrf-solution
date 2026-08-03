# Boundary file upload errors

> **Error message** values are copied from the frontend's message map,
> [`boundary-error-messages.js`](https://github.com/DEFRA/nrf-frontend/blob/main/src/server/common/constants/boundary-error-messages.js).
> They're duplicated here to aid testing and validation — if the wording
> there changes, update it here too so the two stay in sync.

## Geometry errors

When more than one of these could apply, the boundary is checked in this
order and the first problem found is the one reported: empty geometry → not
a polygon → crosses itself → has a hole → duplicate points.

| Code | Trigger | Test file | Error message | Status |
|---|---|---|---|---|
| `invalid_geometry` | the boundary has no shape (empty/null geometry) | [invalid_geometry.geojson](test-files/errors/invalid_geometry.geojson) | The uploaded boundary geometry could not be processed. It contains incomplete or malformed coordinates. | ✅ works |
| `unsupported_geometry_type` | the boundary isn't a polygon (e.g. a line or a point) | [unsupported_geometry_type.geojson](test-files/errors/unsupported_geometry_type.geojson) | Only Polygon geometry is supported. Please ensure the boundary forms a complete closed polygon shape. | ✅ works |
| `self_intersecting_geometry` | the boundary outline crosses over itself (a "bowtie"/figure-8 shape) | [self_intersecting_geometry.geojson](test-files/errors/self_intersecting_geometry.geojson) | The red line boundary is overlapping itself. | ✅ works |
| `geometry_has_holes` | the boundary has a hole cut out of it | [geometry_has_holes.geojson](test-files/errors/geometry_has_holes.geojson) | The red line boundary contains a hole. Please provide a boundary without gaps. | ✅ works |
| `duplicate_vertices` | the boundary has the same point twice in a row | [duplicate_vertices.geojson](test-files/errors/duplicate_vertices.geojson) | The uploaded boundary contains duplicated or overlapping geometry (duplicate consecutive vertices). Please clean up the boundary and try again. | ✅ works |
| `unclosed_ring` | the boundary outline doesn't join back to its starting point (not closed) | [unclosed_ring.geojson](test-files/errors/unclosed_ring.geojson) | The red line boundary is not closed. | ✅ works |
| `no_polygon_found` | the file contains no polygon at all (e.g. an empty file) | [no_polygon_found.geojson](test-files/errors/no_polygon_found.geojson) | The red line boundary is missing. | ✅ works |
| `coordinates_out_of_range` | geometry's bounding box exceeds sensible limits for its CRS (WGS84 lon/lat `[-180,180]`/`[-90,90]`, or BNG easting `[0, 700,000]` / northing `[0, 1,300,000]` — full GB extent) — checked before reprojection | [coordinates_out_of_range.geojson](test-files/errors/coordinates_out_of_range.geojson) | The red line boundary uses co-ordinates that are outside the supported area. | ✅ works |

## Zip-content errors

Zips are only accepted for shapefiles — a shapefile is a set of files that
share a name (`.shp` plus its companions `.shx`, `.dbf`, `.prj`) and have to
be zipped together. These checks are about the zip and the files inside it.
The last two (`boundary_file_not_found_in_zip`, `zip_ambiguous_filename`)
are checked a little later, when the specific file inside the zip is opened.

| Code | Trigger | Test file | Error message | Status |
|---|---|---|---|---|
| `invalid_zip` | the file isn't a valid zip (corrupt or unreadable) | [invalid_zip.zip](test-files/errors/invalid_zip.zip) | The uploaded file is not a valid zip archive. Please check the file and try again. | ✅ works |
| `zip_too_many_files` | the zip contains more than 10 files | [zip_too_many_files.zip](test-files/errors/zip_too_many_files.zip) (11 files) | The uploaded zip contains too many files. Please remove any unnecessary files and try again. | ✅ works |
| `zip_nested_zip` | the zip contains another zip inside it | [zip_nested_zip.zip](test-files/errors/zip_nested_zip.zip) | The uploaded zip contains a nested zip file. Nested zips are not allowed. | ✅ works |
| `zip_unsafe_path` | a file inside the zip has an unsafe name or path (one that tries to escape its folder, or simply contains `..`) | none needed — a genuine escape-the-folder attack is caught even earlier by the zip reader (shown as `invalid_zip`), so this acts as a backstop; it still runs and is exercised directly in unit tests | The uploaded zip contains an entry with an unsafe path. Please check the file and try again. | [✅ unit-tested (nrf-backend)](https://github.com/DEFRA/nrf-backend/blob/main/src/services/zip-safety/zip-safety.test.js) |
| `zip_entry_too_large` | a single file inside the zip is too big — over 20MB once unpacked, or a "zip bomb" (a tiny file that unpacks to something huge) | [zip_entry_too_large.zip](test-files/errors/zip_entry_too_large.zip) (a tiny zip that unpacks to 21MB) | A file inside the uploaded zip is too large. Please reduce the file size and try again. | ✅ works |
| `zip_total_too_large` | everything inside the zip adds up to more than 20MB once unpacked | [zip_total_too_large.zip](test-files/errors/zip_total_too_large.zip) (two files totalling 22MB uncompressed, but compressed to ~120KB so it clears the 2MB upload-size cap) | The uploaded zip is too large once extracted. Please reduce the file size and try again. | ✅ works |
| `zip_missing_shapefile` | the zip has no shapefile (`.shp`) in it — e.g. a zipped GeoJSON, which isn't accepted | [zip_missing_shapefile.zip](test-files/errors/zip_missing_shapefile.zip) | The zipped file is missing one or more required files. | ✅ works |
| `zip_missing_shapefile_parts` | the shapefile is incomplete — a `.shp` is present but one or more of its required companions (`.shx`, `.dbf`, `.prj`) is missing | [zip_missing_shapefile_parts.zip](test-files/errors/zip_missing_shapefile_parts.zip) (`.shp` only) | The zipped file is missing one or more required files. | ✅ works |
| `unsafe_filename` | a file's name contains characters that aren't allowed (only letters, numbers, spaces, dots, underscores, hyphens and brackets are permitted) | [unsafe#filename.geojson](test-files/errors/unsafe%23filename.geojson) — deliberately keeps an unsafe character in its name, since that's exactly what it's testing | The boundary filename contains unsupported characters. Use letters, numbers, spaces, dots, underscores, hyphens or parentheses, and rename the file before uploading it again. | ✅ works |
| `boundary_file_not_found_in_zip` | the file to open can't be found inside the zip — a safety guard for when the expected file is unexpectedly absent | none needed — a normal upload always looks for a file already confirmed to be in the zip, so this can't arise from the UI; it's exercised directly in unit tests instead | The zipped file is missing one or more required files. | [✅ unit-tested (nrf-impact-assessor)](https://github.com/DEFRA/nrf-impact-assessor/blob/main/tests/unit/api/test_check_boundary.py) |
| `zip_ambiguous_filename` | the same filename appears in two different folders inside the zip, so it's unclear which to use | [zip_ambiguous_filename.zip](test-files/errors/zip_ambiguous_filename.zip) (a shapefile with the same name in two folders) | The selected boundary filename appears more than once in the uploaded zip. | ✅ works |

## Co-ordinate Reference System (CRS) / file-type errors

| Code | Trigger | Test file | Error message | Status |
|---|---|---|---|---|
| `unsupported_file_type` | the file isn't one of the accepted types (`.zip`, `.geojson`, `.json`, `.kml`) | [unsupported_file_type.txt](test-files/errors/unsupported_file_type.txt) | The selected file must be a GeoJSON file (.geojson or .json), keyhole markup language file (.kml) or a shapefile (.shp). Shapefiles (.shp) must be .zip files and must contain at least the .shp, .shx, .dbf and .prj files. | ✅ works |
| `unreadable_geometry_file` | the file can't be read as a map file (e.g. it's corrupt, or not really a geometry file) | [unreadable_geometry_file.geojson](test-files/errors/unreadable_geometry_file.geojson) | The uploaded file could not be read. Please check the file and try again. | ✅ works |
| `unsupported_crs` | the file uses a coordinate system we don't support (only British National Grid and WGS 84 are accepted) | [unsupported_crs.geojson](test-files/errors/unsupported_crs.geojson) | The uploaded boundary file is using co-ordinates that are not recognised. | ✅ works |
| `missing_crs` | the file's coordinate system can't be determined. A genuinely *missing* `.prj` doesn't get this far (it's rejected earlier as `zip_missing_shapefile_parts`, which only checks the `.prj` is present, not that it's readable). A real, plausible file — a `.prj` corrupted in transfer, or from an unusual export — gets past that and lands here. | [missing_crs.zip](test-files/errors/missing_crs.zip) — a shapefile whose `.prj` (coordinate-system) file contains unreadable content | The uploaded boundary file is using co-ordinates that are not recognised. | ✅ works |

## CDP Uploader / S3 errors

These come from the file uploader and storage, not from the boundary's
contents. A few can be triggered by choosing the right file — an oversized
file, a virus test file, or an empty file. The rest are upload or
infrastructure problems (the storage being unreachable, the upload not
finished yet, an unknown upload) that no test file can reproduce.

None of these need manual test files: they are all already covered by
automated backend tests. The `Trigger` column below explains what causes
each one.

| Code | Trigger | Test file | Error message | Status |
|---|---|---|---|---|
| `file_size_too_large` | file is over the 2MB limit | [file_size_too_large.geojson](test-files/errors/file_size_too_large.geojson) (over the limit); [exactly_2mb.geojson](test-files/valid/exactly_2mb.geojson) (exactly at the limit — should pass) | The selected file must be smaller than 2MB. | ✅ works |
| `file_contains_virus` | the virus scanner flags the file | [file_contains_virus.geojson](test-files/errors/file_contains_virus.geojson) — antivirus test file | The selected file contains a virus | ✅ works |
| `file_rejected_by_uploader` | the uploader rejects the file for a reason other than size/virus/empty (e.g. it couldn't be saved to storage) | none — not file-driven | The uploaded file was rejected. Please check the file and try again. | [✅ unit-tested (nrf-backend)](https://github.com/DEFRA/nrf-backend/blob/main/src/routes/boundary.test.js) |
| `upload_file_missing` | no file was selected, or the selected file is empty (0 bytes) | [upload_file_missing.geojson](test-files/errors/upload_file_missing.geojson) — a 0-byte file | Select a red line boundary file | ✅ works |
| `upload_not_ready` | the boundary is checked before the upload has finished processing | none — not file-driven | The file upload has not finished processing. Please try again. | [✅ unit-tested (nrf-backend)](https://github.com/DEFRA/nrf-backend/blob/main/src/routes/boundary.test.js) |
| `upload_status_check_failed` | the check on the upload's status fails (e.g. an unknown or expired upload) | none — not file-driven | Unable to check the upload status. Please try again. | [✅ unit-tested (nrf-backend)](https://github.com/DEFRA/nrf-backend/blob/main/src/services/cdp-uploader/cdp-uploader.test.js) |
| `s3_download_failed` | the uploaded file can't be retrieved from storage | none — not file-driven | Unable to retrieve the uploaded file. Please try again. | [✅ unit-tested (nrf-backend)](https://github.com/DEFRA/nrf-backend/blob/main/src/routes/boundary.test.js) |

## Network / infrastructure errors

The boundary-checking service is unreachable or returns something unexpected.
None are file-driven; all are covered by automated backend tests.

| Code | Trigger | Test file | Error message | Status |
|---|---|---|---|---|
| `impact_assessor_unreachable` | the boundary-checking service can't be reached (down, or a network error) | none — not file-driven | Unable to check the boundary right now. Please try again. | [✅ unit-tested (nrf-backend)](https://github.com/DEFRA/nrf-backend/blob/main/src/services/impact-assessor/impact-assessor.test.js) |
| `impact_assessor_bad_response` | the service replies successfully but the response is malformed | none — not file-driven | Unable to check the boundary right now. Please try again. | [✅ unit-tested (nrf-backend)](https://github.com/DEFRA/nrf-backend/blob/main/src/services/impact-assessor/impact-assessor.test.js) |
| `boundary_check_failed` | the service returns an error with no recognisable reason — a catch-all | none — not file-driven | Unable to check the boundary. Please try again. | [✅ unit-tested (nrf-backend)](https://github.com/DEFRA/nrf-backend/blob/main/src/services/impact-assessor/impact-assessor.test.js) |
