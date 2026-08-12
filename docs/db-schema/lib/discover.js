/**
 * Find every SQL schema source in the solution, rather than being told where
 * two of them are.
 *
 * The point is coverage. A hard-coded pair of paths documents whatever was true
 * the day it was written; a new service with its own database, or a repo that
 * moves its migrations, would silently produce a document that looks complete
 * and is not. So the tree is scanned, and anything that looks like a migration
 * source but is not understood is reported as `unknown` for a human to resolve.
 *
 * Database names are read from `compose.yml` — the migration service names both
 * its source directory and the database it targets, so the mapping is derived
 * rather than assumed.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.venv',
  'venv',
  '__pycache__',
  'dist',
  'build',
  '.public',
  'coverage',
  '.playwright-mcp',
  'test-results'
])

/** Other migration tools, so an unrecognised one is reported not ignored. */
const FOREIGN_MARKERS = [
  { file: 'knexfile.js', tool: 'Knex' },
  { file: 'knexfile.ts', tool: 'Knex' },
  { dir: 'prisma', tool: 'Prisma' },
  { dir: 'migrations', tool: 'unknown (a bare migrations/ directory)' },
  { file: 'sequelize.config.js', tool: 'Sequelize' },
  { dir: 'db/migrate', tool: 'ActiveRecord' },
  { file: 'flyway.conf', tool: 'Flyway' }
]

function walk(dir, depth, out) {
  if (depth < 0) return out
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (!e.isDirectory() || SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    out.push(full)
    walk(full, depth - 1, out)
  }
  return out
}

/**
 * Minimal compose reader: service name → its raw block text.
 * Enough to ask "which service mentions this directory, and what database does
 * it name?" without taking a YAML dependency.
 */
function composeServices(repo) {
  const file = path.join(repo, 'compose.yml')
  if (!existsSync(file)) return new Map()
  const src = readFileSync(file, 'utf8')

  const servicesAt = /^services:\s*$/m.exec(src)
  if (!servicesAt) return new Map()
  const body = src.slice(servicesAt.index + servicesAt[0].length)

  const out = new Map()
  const re = /^ {2}([A-Za-z0-9_-]+):[ \t]*$/gm
  const heads = [...body.matchAll(re)]
  heads.forEach((h, i) => {
    const start = h.index + h[0].length
    const end = i + 1 < heads.length ? heads[i + 1].index : body.length
    out.set(h[1], body.slice(start, end))
  })
  return out
}

/** The database a migration source targets, read from the service that runs it. */
function databaseFor(repo, sourcePath, services) {
  const rel = path.relative(repo, sourcePath)
  for (const [name, block] of services) {
    if (!block.includes(rel)) continue
    const jdbc = /jdbc:\w+:\/\/[^/\s]+\/(\w+)/.exec(block)
    if (jdbc) return { database: jdbc[1], service: name }
    const env = /^\s*(?:DB_DATABASE|POSTGRES_DB|PGDATABASE):\s*["']?(\w+)["']?/m.exec(block)
    if (env) return { database: env[1], service: name }
  }
  return { database: null, service: null }
}

/**
 * @returns {{sources: Array, unknown: Array}}
 */
export function discover(repo, { depth = 3 } = {}) {
  const services = composeServices(repo)
  const dirs = walk(repo, depth, [])
  const sources = []
  const unknown = []

  for (const dir of dirs) {
    const base = path.basename(dir)

    // Liquibase: a changelog directory with a master changelog file.
    if (base === 'changelog') {
      const master = readdirSync(dir).find((f) => /^db\.changelog\.xml$/.test(f))
      if (master) {
        sources.push({
          kind: 'liquibase',
          dir,
          repo: path.relative(repo, dir).split(path.sep)[0],
          ...databaseFor(repo, dir, services)
        })
        continue
      }
    }

    // Alembic: a versions directory under an alembic root.
    if (base === 'versions' && path.basename(path.dirname(dir)) === 'alembic') {
      const alembicRoot = path.dirname(dir)
      sources.push({
        kind: 'alembic',
        dir,
        root: alembicRoot,
        repo: path.relative(repo, dir).split(path.sep)[0],
        ...databaseFor(repo, alembicRoot, services)
      })
      continue
    }

    for (const marker of FOREIGN_MARKERS) {
      const hit = marker.dir
        ? base === path.basename(marker.dir) && dir.endsWith(marker.dir)
        : existsSync(path.join(dir, marker.file))
      if (hit) {
        // Not a false positive on our own Alembic/Liquibase trees
        if (/alembic|changelog/.test(dir)) continue
        unknown.push({ dir: path.relative(repo, dir), tool: marker.tool })
      }
    }
  }

  // A source that no compose service runs — impact-assessor's Liquibase
  // changelog is applied on the deployed platform, not locally — still targets
  // its repo's database. Borrow the name from a sibling source that names one.
  for (const s of sources.filter((x) => !x.database)) {
    const sibling = sources.find((x) => x.repo === s.repo && x.database)
    if (sibling) {
      s.database = sibling.database
      s.databaseInferredFrom = sibling.kind
    }
  }

  // Stable order: by repo then kind, so the generated document does not churn.
  sources.sort((a, b) => a.repo.localeCompare(b.repo) || a.kind.localeCompare(b.kind))
  return { sources, unknown }
}

/**
 * Non-SQL datastores in the stack, read from compose service images.
 *
 * They hold no tables and so have no diagram, but a schema document that never
 * mentions them implies the SQL databases are the whole picture. Listing what
 * else holds data — and saying it is out of scope — is more honest than silence.
 */
const DATASTORE_IMAGES = [
  { match: /^mongo(:|$)/, name: 'MongoDB' },
  { match: /redis/, name: 'Redis' },
  { match: /localstack/, name: 'LocalStack (emulates AWS S3 / SQS / SNS)' },
  { match: /elasticsearch|opensearch/, name: 'Elasticsearch' },
  { match: /minio/, name: 'MinIO (S3-compatible object storage)' }
]

export function datastores(repo) {
  const out = []
  for (const [service, block] of composeServices(repo)) {
    const image = /^\s*image:\s*["']?([^"'\s]+)/m.exec(block)?.[1]
    if (!image) continue
    const bare = image.replace(/^.*\//, '')
    const hit = DATASTORE_IMAGES.find((d) => d.match.test(bare))
    if (hit) out.push({ service, image, name: hit.name })
  }
  return out.sort((a, b) => a.service.localeCompare(b.service))
}

/** SQLAlchemy model files a discovered Alembic source can be cross-checked against. */
export function modelFilesFor(source) {
  const repoDir = path.dirname(path.dirname(source.dir))
  const candidates = [
    path.join(repoDir, 'app', 'models', 'db.py'),
    path.join(repoDir, 'app', 'models.py'),
    path.join(repoDir, 'models', 'db.py')
  ]
  return candidates.filter((f) => existsSync(f) && statSync(f).isFile())
}
