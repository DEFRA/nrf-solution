# Valid boundary test files

Happy-path fixtures in [`test-files/valid/`](./test-files/valid) — valid
boundaries that should be accepted. They come in every supported format
(GeoJSON, JSON, KML, and a zipped shapefile) so uploads can be checked in
each. For the error cases, see [errors.md](./errors.md).

## Valid boundary inside an EDP

The main happy path: a valid boundary that overlaps an Environmental
Delivery Plan area. Each returns a successful result with one intersecting
EDP. These use British National Grid coordinates.

| Test file | Format |
|---|---|
| [valid_in_edp.geojson](test-files/valid/valid_in_edp.geojson) | GeoJSON |
| [valid_in_edp.json](test-files/valid/valid_in_edp.json) | JSON |
| [valid_in_edp.kml](test-files/valid/valid_in_edp.kml) | KML |
| [valid_shapefile.zip](test-files/valid/valid_shapefile.zip) | Shapefile (zip) |

## Valid boundary outside any EDP

A valid boundary that doesn't overlap any EDP (a site in central London).
Each returns a successful result with no intersecting EDP. These use WGS 84
coordinates — so together with the set above they cover both supported
coordinate systems.

| Test file | Format |
|---|---|
| [outside_edp.geojson](test-files/valid/outside_edp.geojson) | GeoJSON |
| [outside_edp.json](test-files/valid/outside_edp.json) | JSON |
| [outside_edp.kml](test-files/valid/outside_edp.kml) | KML |
| [outside_edp.zip](test-files/valid/outside_edp.zip) | Shapefile (zip) |

## Size-limit edge case

| Test file | What it checks |
|---|---|
| [exactly_2mb.geojson](test-files/valid/exactly_2mb.geojson) | A valid boundary padded to exactly the 2MB upload limit — confirms a file right at the limit is accepted (anything larger is rejected as `file_size_too_large`). |
