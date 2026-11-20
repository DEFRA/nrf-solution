# Boundary file upload

Test files for uploads are in [./test-files](./test-files).

- [Error cases and codes](./errors.md) — every boundary-check failure code, what triggers it, and its test file
- [Valid boundary test files](./valid-files.md) — happy-path fixtures, in every supported format
- [Sequence diagram of the upload flow](./upload-flow.md)

The **drawn-boundary flow** (the map draw tool on `/quote/draw-boundary`) validates against the same impact-assessor endpoint — it posts the drawn GeoJSON directly to `POST /boundary/check`, where the upload flow posts the uploaded file (`frontend/src/server/common/services/boundary.js`). The error codes in [errors.md](./errors.md) and the valid fixtures in [valid-files.md](./valid-files.md) apply to both flows.
