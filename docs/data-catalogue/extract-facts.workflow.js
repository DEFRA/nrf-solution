export const meta = {
  name: 'nrf-catalogue-v02-facts',
  description: 'Extract and adversarially verify every fact needed to regenerate the NRF data catalogue as V0.2',
  phases: [
    { title: 'Extract', detail: 'six lenses produce evidence-backed asset records' },
    { title: 'Verify', detail: 'each extract adversarially checked as soon as it lands' },
    { title: 'Spec', detail: 'consumed-data field specification' },
  ],
}

const ROOT = '/Users/defra/Desktop/nrf-solution'

const RULES = `
You are working in the DEFRA Nature Restoration Fund (NRF) meta-repo at ${ROOT}.
Submodules: frontend/ (Hapi+Nunjucks), backend/ (Node+Hapi), impact-assessor/ (Python+FastAPI+PostGIS),
admin-frontend/ (Hapi+Nunjucks), journey-tests/ (Cucumber+Playwright).

NEVER read .env* files, compose.override.yml, or secrets. Read config from convict/pydantic
declarations (backend/src/config.js, frontend/src/config/config.js, admin-frontend/src/config/config.js,
impact-assessor/app/config.py) which give names, docs and defaults without secret values.

*** THE CARDINAL RULE ***
Version 0.1 of this catalogue was rejected because it ASSERTED FACTS THAT WERE NOT IN THE REPOSITORY.
It stated "Creator = natural-england" on nine rows when a repo-wide grep for "Natural England"
returns exactly ONE hit (impact-assessor/tests/data/README.md, which is about test boundaries).

Therefore: every value you return is either
  - "confirmed"  : you read it in a file. You MUST give file:line evidence.
  - "inferred"   : a defensible reading of the code. You MUST give the evidence AND the reasoning
                   AND say what would confirm it.
  - "tbc"        : not determinable from the repository. Say who would know.
NEVER guess an organisation name, a licence, an owner, a retention period, or a date.
"tbc" is always the correct answer when the repository does not say. Returning "tbc" is a success,
not a failure. Do not pattern-match from your general knowledge of Defra or Natural England.
`

const ASSET_FIELDS = `
For each asset return these fields. Use "tbc" liberally per the cardinal rule.
  ref_hint                  short suggested reference, e.g. "frontend cookies"
  title                     business-readable name
  description               2-4 sentences: what it holds, why it exists, how it is used
  category                  Environment | Finance | Corporate Services | tbc
  format                    physical format (PostgreSQL table, Redis key-value, S3 object, REST API, cookie, SNS message, ...)
  keyword                   semicolon-separated tags
  security_classification   Official | OFFICIAL - SENSITIVE | tbc  + one line of reasoning
  access_rights             Internal | Open | Commercial | tbc
  source                    where the data comes from
  frequency_of_update       Continuous | Irregular | tbc
  retention                 what the CODE actually enforces (a TTL, an expiry, a cascade delete), or tbc
  licence                   tbc unless the repo states one
  date_of_creation          from git history of the creating file, or tbc
  date_of_modification      from git history, or tbc
  provenance                how it comes to exist and its chain of custody
  creator                   ONLY if the repo names an organisation; otherwise tbc
  data_owner                tbc unless the repo names an individual
  dataset_type              Geographical | Structured Tables | Text | Interactive | tbc
  alias                     physical name(s)
  version                   version scheme if any
  service                   which repo owns it
  store                     technology
  physical_location         db.schema.table / bucket+prefix / endpoint / cookie name / redis key prefix
  contains_personal_data    Yes / Indirectly / No  + the specific field or reason
  approximate_volume        if determinable, else tbc
  asset_grain               "one table" | "N tables" | "part of one table" | "not a table"
  confidence                confirmed | inferred | tbc-heavy
  evidence                  file:line references backing the above
`

const EXTRACT_SCHEMA = {
  type: 'object',
  required: ['assets', 'excluded', 'notes'],
  properties: {
    assets: {
      type: 'array',
      items: {
        type: 'object',
        required: ['ref_hint', 'title', 'description', 'format', 'physical_location', 'contains_personal_data', 'confidence', 'evidence'],
        properties: {
          ref_hint: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' },
          category: { type: 'string' }, format: { type: 'string' }, keyword: { type: 'string' },
          security_classification: { type: 'string' }, access_rights: { type: 'string' },
          source: { type: 'string' }, frequency_of_update: { type: 'string' },
          retention: { type: 'string' }, licence: { type: 'string' },
          date_of_creation: { type: 'string' }, date_of_modification: { type: 'string' },
          provenance: { type: 'string' }, creator: { type: 'string' }, data_owner: { type: 'string' },
          dataset_type: { type: 'string' }, alias: { type: 'string' }, version: { type: 'string' },
          service: { type: 'string' }, store: { type: 'string' }, physical_location: { type: 'string' },
          contains_personal_data: { type: 'string' }, approximate_volume: { type: 'string' },
          asset_grain: { type: 'string' }, confidence: { type: 'string' }, evidence: { type: 'string' },
        },
      },
    },
    columns: {
      type: 'array',
      description: 'column-level data dictionary rows, where this lens covers database tables',
      items: {
        type: 'object',
        required: ['table', 'column', 'data_type'],
        properties: {
          asset_ref_hint: { type: 'string' }, database: { type: 'string' }, schema: { type: 'string' },
          table: { type: 'string' }, column: { type: 'string' }, data_type: { type: 'string' },
          key_constraint: { type: 'string' }, nullable: { type: 'string' },
          description: { type: 'string' }, personal_data: { type: 'string' },
        },
      },
    },
    excluded: { type: 'string', description: 'what you deliberately left out and why' },
    notes: { type: 'string', description: 'anything uncertain, contradictory, or worth flagging' },
  },
}

const LENSES = [
  {
    key: 'backend-schema',
    prompt: `LENS: the CURRENT nrf_backend Postgres schema, column by column.

CRITICAL: backend/docs/quote-database-diagram.md is STALE (it says "Generated: 2026-06-19" and
still lists dropped columns). DO NOT USE IT AS A SOURCE. Derive the schema ONLY by reading every
file in backend/changelog/ in changelog order and applying each changeset in sequence, including
raw <sql> blocks. Cross-check the result against the actual INSERT/SELECT statements in
backend/src/services/db/.

Produce:
1. The exact CURRENT column list for users, quotes, quote_access_tokens, quote_edp_results —
   after all drops, renames and recreates. Note db.changelog-1.6.xml renames and recreates
   quote_edp_results; db.changelog-2.3.xml and 2.5.xml DROP columns; 2.4.xml and 2.6.xml ADD
   columns. Get the end state right.
2. For each table: date_of_creation = commit date the creating changelog file was added;
   date_of_modification = commit date of the most recent changelog file touching it.
   Use: git log --diff-filter=A --format=%ad --date=short -- <file> | tail -1
3. Asset records for the four tables.
4. Full column-level rows for the data dictionary.
5. Report exactly which columns the stale ERD gets wrong, so the ERD can be fixed separately.`,
  },
  {
    key: 'impact-schema-layers',
    prompt: `LENS: the nrf_impact PostGIS schema and the consumed spatial reference layers.

Read impact-assessor/app/models/db.py, alembic/versions/*, scripts/load_data.py,
scripts/.env.example, docs/local-data-load.md, app/config.py, app/data_sync/*, qc_rules.yaml.

Produce asset records for: the 10 spatial layers, the 2 lookup_table logical assets
(wwtw_lookup, rates_lookup), and ONE combined asset for the four data_sync_* audit tables.
Plus column-level rows for every table.

For EACH consumed layer, establish ONLY what the repo actually says:
- the exact source filename and layer name from docs/local-data-load.md and .env.example,
  INCLUDING any vintage or TEST marker in the name (e.g. NMSCoefficientLayerTEST.gpkg,
  NN_Catchments_03_2024.shp, WFD_..._Cycle_2.shp, Interim_coeffs.sqlite)
- which columns load_data.py actually keeps versus drops at load time
- what the layer is used for: grep the assessment code for each table and report the
  read sites. If a layer has NO read site, say so explicitly.
- whether qc_rules.yaml has rules for it

*** SUPPLIER ATTRIBUTION — THE CARDINAL RULE APPLIES HARDEST HERE ***
Run: grep -rniE "natural england|environment agency|ordnance survey|ONS|MHCLG|Cranfield|LandIS|RPA|CROME"
over impact-assessor/app, /scripts, /alembic, /docs, /changelog and the two READMEs.
Report EXACTLY what hits you get and where. For every layer where no organisation is named,
creator MUST be "tbc" with a note on who would know. Do NOT infer a supplier from a layer name.

Separately: read the committed fixture schemas at impact-assessor/tests/data/fixtures/*.gpkg
(they are SQLite; you can query their table_info). Report any column names or values that
indicate third-party licensed content (e.g. OS MasterMap DESCRIPTIVEGROUP/DESCRIPTIVETERM/
OSMMSTYLE_NAME, RPA CROME cromeid values, Cranfield soilscape class strings). Report this as
EVIDENCE ABOUT LICENSING that belongs in the provenance field — clearly labelled as derived
from the test fixture, not the production layer.`,
  },
  {
    key: 'frontend-non-table',
    prompt: `LENS: nrf-frontend data assets that are NOT database tables. These were all missing from V0.1.

Produce a separate asset record for each of:
1. EVERY cookie the frontend sets. Read frontend/src/server/common/helpers/cookies/,
   csrf.js, quote-details-session-cookie.js, defra-identity.js, and any server.state() call.
   For each: exact cookie name, TTL, httpOnly/secure/sameSite, what it contains, encoding.
   ALSO check frontend/src/server/cookies/index.njk against reality — report any cookie the
   page advertises that the code does not set, or vice versa.
2. The yar journey session in Redis — key prefix, TTL, and EXACTLY what is stored
   (read quote-schema/index.js, quote-session-cache/, form-validation-session/,
   session-rate-limit/). Name every personal-data field including email.
3. The SEPARATE identity session cache segment — read server.js for the server.cache()
   call, its segment name and hard-coded expiresIn, and defra-identity.js createUserSession
   for exactly what is stored (tokens? refresh tokens? claims?). This is a DIFFERENT asset
   from the yar session with a DIFFERENT TTL. Report both TTLs and the discrepancy.
4. The Redis tile cache — key prefix, what is cached, TTL.
5. Browser-direct third-party egress. Read content-security-policy.js and every file in
   src/client/data/vts/. Enumerate every external origin the BROWSER contacts directly
   (bypassing the server proxy), what it fetches, and whether any dependency is unpinned.
6. Google Tag Manager / Google Analytics — config key, default, consent-mode defaults,
   whether any custom dataLayer pushes exist, and whether it is active by default.
7. The Qualtrics feedback link.
8. The OS Names API and OS Vector Tile API as consumed assets — for OS Names specifically,
   determine whether user-typed free text leaves the estate and whether the call is
   server-side or browser-side. This affects the personal-data judgement.

For every TTL, quote the config key, its default, and the file:line.`,
  },
  {
    key: 'backend-non-table',
    prompt: `LENS: nrf-backend data assets and flows that are NOT database tables. All missing from V0.1.

Produce a separate asset record for each of:
1. The CDP audit event stream. Read backend/src/api/quote/post-controller.js and
   patch-controller.js and any @defra/cdp-auditing usage. For each audit event: the event name
   and EXACTLY what the context payload contains. Determine whether the raw applicant email
   and the boundary geometry are included (check quote-row-mapper.js for what a mapped quote
   contains). Report the config flag that enables it and the disable_analytics_audit gate.
2. The SNS topic / SQS queue assessment job. Read publish-quote-message.js, publish-event.js,
   post-controller.js, and compose/start-localstack.sh. Report the exact message payload
   fields, the topic and queue names as created versus as configured (there is a naming
   mismatch), and what happens on publish failure (read publish-event.js carefully — does it
   swallow or re-throw?).
3. GET /quotes — the bulk export. Read get-all-quotes.js, routes/quote.js, plugins/auth.js.
   Report: whether there is a LIMIT or WHERE clause, what columns the SELECT returns
   (does it join the email?), and the exact auth mechanism (is it a shared static key?).
4. S3 buckets. Read compose/start-localstack.sh and backend/src/services/s3/s3-client.js.
   How many buckets exist and what are they for? Which S3 commands does the backend import —
   check specifically whether any Put/Delete/List command is imported, and whether any
   cron/setInterval/scheduled job exists in backend/src. This determines whether uploads are
   ever deleted.
5. The CDP Uploader status/details feed as a consumed asset — what fields come back, and what
   gets logged.
6. GOV.UK Notify. Read send-quote-email.js, send-email-client.js, build-quote-access-link.js.
   Determine the exact form of the quote access link and whether the RAW token appears in it.
   If so, the email body is a bearer credential held by a third-party processor — record that
   in the provenance and personal-data fields.
7. Any other outbound HTTP call the backend makes.`,
  },
  {
    key: 'admin-frontend',
    prompt: `LENS: nrf-admin-frontend — completely absent from V0.1 despite being named in scope.

Enumerate every route and every data asset. Specifically:
1. Read src/server/routes/ exhaustively. What does each route read or write?
2. src/server/routes/home/get-quotes.js and index.njk — what does the landing page fetch and
   render? Does it display applicant email addresses? Is it paginated?
3. The OIDC auth: src/server/plugins/oidc-auth-plugin.js, config.js, auth-callback-controller.js.
   Which identity providers are involved? Report the exact provider names and the admin
   allow-list mechanism.
4. src/server/common/helpers/auditing/ — what staff events are audited and with what payload?
5. save-user-session.js and session-cookie.js — what is stored in the admin session, in which
   store, under what key prefix, with what TTL? Are access or refresh tokens stored?
6. src/server/routes/api/uploads/ — what does the upload proxy do and what auth guards it?
7. src/server/routes/api/data-sync/ — this appears to be the reference-data reload control
   plane. What does the trigger payload contain (read schemas.js)? What auth guards it?
   What is forwarded to the impact-assessor?

Produce one asset record per distinct data asset, not one per route. Include the staff-user
data as its own asset if staff identities are stored.`,
  },
  {
    key: 'impact-outputs-fixtures',
    prompt: `LENS: nrf-impact-assessor PRODUCED outputs, transient state, and committed data. All missing from V0.1.

Produce a separate asset record for each of:
1. The MVT tile endpoints. Read app/tiles/router.py — which layers are served, is there any
   auth dependency, and is there an in-process cache? Note any comment about withdrawn layers.
2. The in-memory assessment job store. Read app/assess/router.py — the module-level _jobs dict:
   what does a JobState hold, is there an access token, is there a TTL prune? This holds full
   assessment results and boundary geometry in process memory.
3. The repository-level caches in app/repositories/repository.py (land use, intersection).
4. app/debug.py — what does it write, where, and what gates it?
5. The S3 dump bucket and manifest. Read app/config.py DataSyncConfig and app/data_sync/service.py.
   What is the bucket for, what does the manifest contain, is the feature enabled by default,
   and what is persisted about who triggered a reload?
6. MongoDB. Read app/common/mongo.py and app/main.py. Is it actually used for anything beyond a
   startup ping? Report the truth — AGENTS.md claims Mongo is used by frontend/backend for
   sessions and app state; verify or refute that across all repos.
7. The committed test fixtures as a data asset. impact-assessor/tests/data/fixtures/*.gpkg and
   tests/data/expected/*.csv. Report: total size, whether git-tracked, whether the repo is
   public (run: gh repo view DEFRA/nrf-impact-assessor --json visibility,name,owner), what
   scripts/extract_test_fixtures.py clips them FROM, and — reading the expected CSVs directly —
   whether they contain real planning references, site addresses or postcodes. Quote exact lines.
8. journey-tests/test/support/find-notify-email.js — does the test harness read live
   notifications from a shared GOV.UK Notify account? What does the response expose?

Also: DataProvenance. Read app/models/domain.py, app/data_sync/service.py resolve_active_provenance,
app/orchestrator.py, app/clients/payload_mapper.py and backend patch-schema.js. Trace whether
provenance survives from the assessment into the backend's stored result. Report the exact
line where it is dropped. This is the single most important lineage finding.`,
  },
]

// ---------------------------------------------------------------- Extract → Verify (pipelined)
phase('Extract')

const results = await pipeline(
  LENSES,
  lens => agent(`${RULES}\n\n${lens.prompt}\n\n${ASSET_FIELDS}`,
    { label: `extract:${lens.key}`, phase: 'Extract', schema: EXTRACT_SCHEMA, effort: 'high' }),
  (extract, lens) => {
    if (!extract) return null
    return agent(`${RULES}

You are an adversarial fact-checker. Another agent produced the asset records below for the
lens "${lens.key}". Version 0.1 of this catalogue failed because unverified assertions were
published as fact. Your job is to catch that before it happens again.

For EVERY field marked "confirmed", open the cited file and check it. For every organisation
name, licence, date, TTL, volume or retention claim, verify it independently. Any claim you
cannot verify from the repository must be downgraded to "tbc".

Be especially ruthless about:
- organisation names that appear nowhere in the repo
- dates not backed by git history
- TTLs and retention claims not backed by a config default or a schema default
- "contains personal data: No" judgements that are wrong
- schema claims that ignore a later DROP or RENAME

RECORDS TO CHECK:
${JSON.stringify(extract, null, 1)}

Return the SAME structure, corrected. Keep every asset, but fix every field you found wrong and
downgrade every unverifiable claim to "tbc". In notes, list precisely what you changed and why.`,
      { label: `verify:${lens.key}`, phase: 'Verify', schema: EXTRACT_SCHEMA, effort: 'high' })
      .then(v => ({ lens: lens.key, verified: v, original: extract }))
  }
)

const clean = results.filter(Boolean)
const assetCount = clean.reduce((n, r) => n + ((r.verified?.assets || []).length), 0)
const colCount = clean.reduce((n, r) => n + ((r.verified?.columns || []).length), 0)
log(`Verified ${assetCount} asset records and ${colCount} column rows across ${clean.length} lenses`)

// ---------------------------------------------------------------- Consumed-data field spec
phase('Spec')

const spec = await agent(`${RULES}

TASK: specify the extra metadata fields a data catalogue needs for CONSUMED third-party data,
which the Defra Minimum Metadata V0.3 standard does not provide.

Context: this service consumes ~12 spatial reference datasets from outside the organisation.
Those datasets determine the environmental impact figures shown to developers. The Defra
standard was written for data an organisation owns and publishes, so it has Licence, Source,
Access Rights, Provenance, Valid From/To, Status and Creator — but nothing for the supply
relationship itself.

Verified evidence from the codebase:
${JSON.stringify(clean.map(r => ({ lens: r.lens, notes: r.verified?.notes, excluded: r.verified?.excluded })), null, 1)}

Specify each NEW field with: field name, definition, datatype/value list, cardinality
(1:1, 1:N, 0..1:1, 0..1:N), why the standard's existing fields do not cover it (name the
closest existing field and say why it falls short), and — for the NRF reference layers
specifically — what the value would be today or "tbc".

Cover at minimum: the supply route / data sharing agreement, the upstream data owner AT the
supplying organisation, the supplier's own refresh cadence and current edition, redistribution
and onward-publication rights, supply-continuity risk (the security register uses CIA ratings
for its platforms; consider whether to reuse that scheme), the correction-and-withdrawal
policy, and the downstream-impact link that lets you identify which outputs were computed from
a given version of an input.

Also specify an "Asset grain" field: one table / N tables / part of one table / not a table,
and the rule for deciding when several physical tables are one catalogue asset.

Return markdown, ready to paste into a spreadsheet tab.`,
  { label: 'spec:consumed-data-fields', phase: 'Spec', effort: 'high' })

return {
  lenses: clean.map(r => r.lens),
  assetCount,
  colCount,
  assets: clean.flatMap(r => (r.verified?.assets || []).map(a => ({ ...a, lens: r.lens }))),
  columns: clean.flatMap(r => (r.verified?.columns || []).map(c => ({ ...c, lens: r.lens }))),
  verifierNotes: clean.map(r => ({ lens: r.lens, notes: r.verified?.notes, excluded: r.verified?.excluded })),
  spec,
}
