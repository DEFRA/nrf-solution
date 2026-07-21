# Boundary file upload — complete flow

How a red line boundary file moves from the browser, through CDP Uploader, nrf-frontend
and nrf-backend, to nrf-impact-assessor and back — starting at `/quote/upload-boundary`.
Covers the happy path, the poll-while-processing loop, and where each service's
validation sits.

```mermaid
flowchart TD
  subgraph browser [Browser]
    A([GET /quote/upload-boundary]) --> B[Form rendered<br/>action = CDP Uploader upload URL]
    B --> C[User selects file - browser POSTs<br/>multipart/form-data directly to CDP Uploader]
    D([Browser redirected to<br/>/quote/upload-received])
    E{Upload status?}
    F[Page meta-refreshes<br/>after 5s]
    X([Error page shown -<br/>manual retry link])
    G([GET /quote/upload-preview-map])
  end

  subgraph frontend [nrf-frontend]
    H[Call backend<br/>POST /upload/initiate]
    I[Store pendingUploadId +<br/>pendingUploadUrl in session]
    J[Call backend<br/>GET /upload/uploadId/status]
    K[Call backend<br/>POST /boundary/check/uploadId]
    L[Store boundaryGeojson or<br/>boundaryFailureReason in session]
  end

  subgraph backend [nrf-backend]
    M[POST CDP Uploader /initiate]
    N[GET CDP Uploader /status/uploadId<br/>lightweight status]
    O[GET CDP Uploader /status/uploadId<br/>full file details]
    P[Download file from S3]
    Q{Validate filename;<br/>if zip, also validate<br/>zip safety + shapefile contents}
    R[POST impact-assessor<br/>/check-boundary]
  end

  subgraph cdp [CDP Uploader]
    S[(Store file in S3)]
    T[Mark upload ready<br/>or rejected]
  end

  subgraph ia [nrf-impact-assessor]
    U[Parse geometry file,<br/>reproject to WGS84]
    V{Geometry valid?}
    W[(Query EDP intersections<br/>in Postgres)]
  end

  A --> H --> M --> I --> B
  C --> S --> T --> D
  D --> J --> N --> E
  E -- pending / initiated --> F --> J
  E -- error / failed / unknown --> X
  E -- ready --> K --> O --> P --> Q
  Q -- invalid --> L
  Q -- valid --> R --> U
  U -- unreadable file /<br/>unsupported CRS --> L
  U -- ok --> V
  V -- no --> L
  V -- yes --> W --> L
  L --> G
```

> **File goes browser → CDP Uploader directly:** the actual file bytes never pass through
> nrf-frontend or nrf-backend. `/upload/initiate` only asks CDP Uploader for a one-time
> upload URL and ID; the browser's `<form>` posts the file straight to that URL, and CDP
> Uploader redirects the browser to `/quote/upload-received` once it has stored the file
> in S3.

> **"Ready" doesn't mean "accepted":** CDP Uploader can mark an upload `ready` even when
> it rejected the file itself (virus scan failure, over the size limit). The lightweight
> status check (`N`) only tells the frontend when to stop polling — the rejection is only
> discovered when nrf-backend calls CDP Uploader's status endpoint again for full file
> details (`O`) as part of `/boundary/check/{uploadId}`.

> **Backend, not impact-assessor, owns file/zip validation:** filename safety, zip-bomb
> and zip-slip checks, and shapefile-companion-file checks all happen in nrf-backend
> before the file is ever sent to nrf-impact-assessor. Impact-assessor only receives a
> file it can assume is already a safe, well-formed archive, and its job is limited to
> geometry parsing/validation and EDP intersection lookups.

> **Every failure is a machine-readable code:** nrf-backend and nrf-impact-assessor never
> return display text — only a stable code (e.g. `unsupported_crs`, `zip_missing_shapefile`).
> nrf-frontend is the only place that maps a code to user-facing copy
> (`constants/boundary-error-messages.js`), so wording can change without touching either
> service.
