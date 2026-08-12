#!/usr/bin/env node
/**
 * Generate docs/database-schema.md from the migration sources in every repo.
 *
 * Why this exists: the schema is defined in two repos by two different tools,
 * and the documentation of it has drifted before — `quote-database-diagram.md`
 * fell four changesets behind, listing four dropped columns and omitting two
 * added ones, and became the source of a wrong data dictionary (gap G14).
 * Anything hand-maintained here will drift again, so it is derived instead.
 *
 * Usage:
 *   node docs/db-schema/generate.js            # write the document
 *   node docs/db-schema/generate.js --check    # exit 1 if it is out of date
 *   node docs/db-schema/generate.js --stamp    # append generation provenance
 *
 * No dependencies — it runs in CI with nothing installed.
 *
 * The generated body is deterministic: no dates, no submodule SHAs, nothing
 * environment-derived. Provenance is git history. `--check` therefore fails
 * only when the schema has genuinely changed, not on unrelated commits.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { datastores, discover, modelFilesFor } from './lib/discover.js'
import { readLiquibase } from './lib/liquibase.js'
import { readAlembic } from './lib/alembic.js'
import { readModels, compare } from './lib/models.js'
import { columnTable, erDiagram, groupByShape, indexTable } from './lib/render.js'
import { findStaleDiagrams } from './lib/stale.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..', '..')
const OUTPUT = path.join(REPO, 'docs', 'database-schema.md')

/** Framework plumbing, not domain data. */
const SYSTEM_TABLES = new Set([
  'databasechangelog',
  'databasechangeloglock',
  'alembic_version',
  'spatial_ref_sys',
  'geometry_columns',
  'geography_columns'
])

const rel = (p) => path.relative(REPO, p).split(path.sep).join('/')

// ---------------------------------------------------------------- collect

function readSource(source) {
  if (source.kind === 'liquibase') return readLiquibase(source.dir)
  if (source.kind === 'alembic') return readAlembic(source.dir)
  throw new Error(`no reader for source kind: ${source.kind}`)
}

/**
 * Group discovered sources by the database they target. Two sources on one
 * database (impact-assessor keeps parallel Alembic and Liquibase definitions)
 * are compared rather than merged — if they disagree, that is drift worth
 * reporting, not something to silently pick a winner for.
 */
function collect() {
  const { sources, unknown } = discover(REPO)
  const databases = new Map()
  const notes = []

  for (const source of sources) {
    const parsed = readSource(source)
    for (const t of SYSTEM_TABLES) parsed.tables.delete(t)

    const db = source.database ?? `(unknown database: ${source.repo})`
    if (!databases.has(db)) {
      databases.set(db, { name: db, repos: new Set(), sources: [], primary: null })
    }
    const entry = databases.get(db)
    entry.repos.add(source.repo)
    entry.sources.push({ source, parsed })

    // The definition a running environment applies is the one to document.
    // Where a database has both, they are verified equal below.
    if (!entry.primary || source.kind === 'alembic') entry.primary = { source, parsed }
  }

  for (const entry of databases.values()) {
    // Cross-check parallel definitions of the same database.
    if (entry.sources.length > 1) {
      const [a, ...rest] = entry.sources
      for (const b of rest) {
        const diff = compare(a.parsed, b.parsed)
        entry.parity = {
          a: a.source,
          b: b.source,
          differences: diff
        }
        if (diff.length) {
          notes.push(
            `\`${entry.name}\`: ${a.source.kind} (${rel(a.source.dir)}) and ` +
              `${b.source.kind} (${rel(b.source.dir)}) disagree — ${diff.join('; ')}`
          )
        }
      }
    }

    // Cross-check against SQLAlchemy models, which also supply the
    // application-side defaults the migrations cannot show.
    for (const { source, parsed } of entry.sources) {
      for (const file of modelFilesFor(source)) {
        const models = readModels(file)
        if (!models.tables.size) continue
        const diff = compare(parsed, models)
        entry.models = { file, diff }
        if (diff.length) {
          notes.push(`\`${entry.name}\`: migrations and ${rel(file)} disagree — ${diff.join('; ')}`)
        }
        // Fold client-side defaults into the documented columns.
        for (const [name, mt] of models.tables) {
          const target = parsed.tables.get(name)
          if (!target) continue
          for (const mc of mt.columns) {
            const tc = target.columns.find((c) => c.name === mc.name)
            if (tc && mc.clientDefault && !tc.clientDefault) tc.clientDefault = mc.clientDefault
          }
          if (mt.docstring && !target.docstring) target.docstring = mt.docstring
        }
      }
    }
  }

  // Any other hand-maintained ER diagram in the tree that disagrees with the
  // real schema. This is the check that would have caught gap G14.
  const everyTable = new Map()
  for (const d of databases.values()) {
    for (const [name, t] of d.primary.parsed.tables) everyTable.set(name, t)
  }
  const stale = findStaleDiagrams(REPO, everyTable, [OUTPUT])

  return { databases, unknown, notes, sources, stale }
}

// ---------------------------------------------------------------- render

function repoInventory() {
  const dirs = []
  const gitmodules = path.join(REPO, '.gitmodules')
  if (existsSync(gitmodules)) {
    for (const m of readFileSync(gitmodules, 'utf8').matchAll(/^\s*path\s*=\s*(.+)$/gm)) {
      dirs.push(m[1].trim())
    }
  }
  return dirs
}

function renderDatabase(entry) {
  const out = []
  const { parsed, source } = entry.primary
  const tables = [...parsed.tables.values()].sort((a, b) => a.name.localeCompare(b.name))

  const uniqueColumns = new Map()
  for (const c of parsed.constraints) {
    if (c.kind !== 'UNIQUE' || (c.columns ?? []).length !== 1) continue
    if (!uniqueColumns.has(c.table)) uniqueColumns.set(c.table, new Set())
    uniqueColumns.get(c.table).add(c.columns[0])
  }

  out.push(`## \`${entry.name}\``)
  out.push('')
  // Schemas are read from the migrations. Worth stating explicitly: several
  // files in this repo claim nrf_impact uses a schema called `nrf_reference`,
  // and no migration or model creates one.
  const schemas = [...new Set(tables.map((t) => t.schema ?? 'public'))].sort()
  out.push(
    `Owned by \`${[...entry.repos].join('`, `')}\`. ` +
      `${tables.length} domain ${tables.length === 1 ? 'table' : 'tables'} in ` +
      `${schemas.length === 1 ? 'schema' : 'schemas'} \`${schemas.join('`, `')}\`, defined by ` +
      entry.sources.map((s) => `**${toolName(s.source.kind)}** (\`${rel(s.source.dir)}\`)`).join(' and ') +
      '.'
  )
  out.push('')

  if (entry.parity) {
    const { differences } = entry.parity
    out.push(
      differences.length
        ? `> **These two definitions disagree.** ${differences.join('; ')}`
        : `> This database is defined twice — once per tool — and the two agree: ` +
          `the same ${tables.length} tables with the same columns. ` +
          `\`${rel(path.join(path.dirname(entry.parity.b.dir), '..', 'scripts', 'check_migration_parity.py'))}\`` +
          ` enforces that every Alembic revision has a matching Liquibase changeset.`
    )
    out.push('')
  }

  // Tables that share an identical column set are drawn once.
  const groups = groupByShape(tables)
  const shared = groups.filter((g) => g.length > 1)
  const singles = groups.filter((g) => g.length === 1).flat()

  out.push('### Diagram')
  out.push('')
  if (singles.length) {
    out.push(erDiagram(singles, { uniqueColumns }))
    out.push('')
  }

  for (const group of shared) {
    const [first, ...rest] = group
    out.push(
      `${rest.length + 1} tables share one identical column set. It is drawn once, on ` +
        `\`${first.name}\`:`
    )
    out.push('')
    out.push(erDiagram([first], { uniqueColumns }))
    out.push('')
    out.push(
      `The same shape is used by ${rest.map((t) => `\`${t.name}\``).join(', ')}. ` +
        'These tables carry no foreign keys — they are independent reference layers, ' +
        'joined spatially at query time.'
    )
    out.push('')
  }

  out.push('### Tables')
  out.push('')
  for (const t of tables) {
    out.push(`#### \`${t.name}\``)
    out.push('')
    if (t.docstring) {
      out.push(t.docstring.split('\n')[0].trim())
      out.push('')
    }
    out.push(columnTable(t, { constraints: parsed.constraints, indexes: parsed.indexes }))
    out.push('')
    if (t.comment) {
      out.push(`> ${t.comment}`)
      out.push('')
    }
  }

  out.push('### Indexes and constraints')
  out.push('')
  out.push(indexTable(parsed.constraints, parsed.indexes))
  out.push('')

  // The reasoning recorded alongside a change is the part a column list cannot
  // convey, and the part a reader most often needs. Carried through verbatim.
  const notes = entry.sources.flatMap(({ source, parsed: p }) =>
    (p.notes ?? []).map((n) => ({ ...n, kind: source.kind }))
  )
  if (notes.length) {
    out.push('### Why the schema looks like this')
    out.push('')
    out.push('Recorded by whoever made the change, carried through from the migration sources.')
    out.push('')
    for (const n of notes) {
      const where = n.tables.length
        ? n.tables.map((t) => `\`${t}\``).join(', ')
        : `\`${n.file}\``
      out.push(`**${where}** — ${n.comment}`)
      out.push('')
      out.push(`_${toolName(n.kind)} changeset \`${n.changeset}\` in \`${n.file}\`._`)
      out.push('')
    }
  }

  const clientDefaults = tables.flatMap((t) =>
    t.columns.filter((c) => c.clientDefault).map((c) => `\`${t.name}.${c.name}\``)
  )
  if (clientDefaults.length) {
    out.push(
      `> **Application-side defaults.** ${clientDefaults.length} columns take their default ` +
        'from the application, not the database — SQLAlchemy `default=` is applied in Python ' +
        'when the model is instantiated. A raw `INSERT` that omits them will fail. ' +
        'They are marked in the tables above.'
    )
    out.push('')
  }

  return out.join('\n')
}

const toolName = (kind) => ({ liquibase: 'Liquibase', alembic: 'Alembic' })[kind] ?? kind

function render({ databases, unknown, notes, sources, stale = [] }) {
  const out = []
  const dbs = [...databases.values()].sort((a, b) => a.name.localeCompare(b.name))
  const withSql = new Set(sources.map((s) => s.repo))
  const allRepos = repoInventory()
  const withoutSql = allRepos.filter((r) => !withSql.has(r))
  const totalTables = dbs.reduce((n, d) => n + d.primary.parsed.tables.size, 0)

  out.push('<!-- Generated by docs/db-schema/generate.js — do not edit by hand. -->')
  out.push('')
  out.push('# Database schema')
  out.push('')
  out.push(
    `Every SQL table in the NRF service, across all repos, with entity-relationship diagrams. ` +
      `${totalTables} tables in ${dbs.length} databases.`
  )
  out.push('')
  out.push(
    '**This file is generated.** Run `node docs/db-schema/generate.js` after any migration ' +
      'that adds, drops or alters a table or column. Editing it by hand will be overwritten, ' +
      'and CI checks that it matches the migration sources.'
  )
  out.push('')

  out.push('## Where the data lives')
  out.push('')
  out.push('| Database | Schema | Owned by | Defined by | Domain tables |')
  out.push('| --- | --- | --- | --- | --- |')
  for (const d of dbs) {
    const schemas = [
      ...new Set([...d.primary.parsed.tables.values()].map((t) => t.schema ?? 'public'))
    ].sort()
    out.push(
      `| \`${d.name}\` | \`${schemas.join('`, `')}\` | \`${[...d.repos].join('`, `')}\` | ` +
        d.sources.map((s) => `${toolName(s.source.kind)} (\`${rel(s.source.dir)}\`)`).join(', ') +
        ` | ${d.primary.parsed.tables.size} |`
    )
  }
  out.push('')

  if (withoutSql.length) {
    out.push(
      `\`${withoutSql.join('`, `')}\` own no SQL tables — no migration source of any kind was ` +
        'found in them.'
    )
    out.push('')
  }

  out.push('```mermaid')
  out.push('flowchart LR')
  for (const d of dbs) {
    for (const repo of [...d.repos].sort()) {
      out.push(`    ${ident(repo)}["${repo}"] -->|SQL| ${ident(d.name)}[("${d.name}")]`)
    }
  }
  for (const r of withoutSql) out.push(`    ${ident(r)}["${r}"]`)
  out.push('```')
  out.push('')
  out.push(
    'Framework plumbing is excluded throughout: `databasechangelog`, `databasechangeloglock` ' +
      '(Liquibase), `alembic_version` (Alembic), and `spatial_ref_sys` with the ' +
      '`geometry_columns` / `geography_columns` views (PostGIS).'
  )
  out.push('')

  for (const d of dbs) {
    out.push('---')
    out.push('')
    out.push(renderDatabase(d))
  }

  const stores = datastores(REPO)
  if (stores.length) {
    out.push('---')
    out.push('')
    out.push('## Non-SQL stores')
    out.push('')
    out.push(
      'Out of scope for the diagrams above — they hold no tables — but listed so the picture ' +
        'is complete. Found in `compose.yml`.'
    )
    out.push('')
    out.push('| Store | Compose service | Image |')
    out.push('| --- | --- | --- |')
    for (const s of stores) out.push(`| ${s.name} | \`${s.service}\` | \`${s.image}\` |`)
    out.push('')
  }

  out.push('---')
  out.push('')
  out.push('## How this is produced')
  out.push('')
  out.push(
    'The migration sources are the input — no live database is required, so this runs in CI. ' +
      'Sources are discovered by scanning the tree rather than being listed, so a new service ' +
      'with its own database is picked up rather than silently missed.'
  )
  out.push('')
  out.push('| Source | Tool | Database |')
  out.push('| --- | --- | --- |')
  for (const s of sources) {
    out.push(
      `| \`${rel(s.dir)}\` | ${toolName(s.kind)} | \`${s.database ?? 'unknown'}\`` +
        `${s.databaseInferredFrom ? ` _(inferred from the ${s.databaseInferredFrom} source in the same repo)_` : ''} |`
    )
  }
  out.push('')

  out.push('Three things the generator is careful about, each of which produced a wrong answer first time:')
  out.push('')
  out.push(
    '- **Liquibase `<rollback>` blocks hold the inverse operation.** An `addColumn` changeset ' +
      'contains a `dropColumn` rollback, so parsing rollbacks as real operations cancels out ' +
      'every column ever added. They are stripped before parsing.'
  )
  out.push(
    "- **Alembic's `downgrade()` is the same trap.** Only `upgrade()` is read, and revisions " +
      'are applied in `down_revision` order — the later revision ids are content hashes and ' +
      'sort arbitrarily by filename.'
  )
  out.push(
    '- **Schema-changing DDL also arrives as raw SQL.** `quotes.reference` exists only in a ' +
      'raw `<sql>` block, and `quote_edp_results` was dropped and recreated there with a ' +
      'different column set. Raw SQL is parsed, and anything unrecognised fails the build ' +
      'rather than being skipped.'
  )
  out.push('')

  if (unknown.length) {
    out.push('### Unrecognised sources')
    out.push('')
    out.push('Found while scanning, but not understood by this generator. Resolve before trusting the table above:')
    out.push('')
    for (const u of unknown) out.push(`- \`${u.dir}\` — looks like ${u.tool}`)
    out.push('')
  }

  out.push('### Cross-checks')
  out.push('')
  out.push('Each run verifies the sources against each other and fails if they disagree:')
  out.push('')
  for (const d of dbs) {
    if (d.parity) {
      out.push(
        `- \`${d.name}\`: ${toolName(d.parity.a.kind)} vs ${toolName(d.parity.b.kind)} — ` +
          (d.parity.differences.length ? `**${d.parity.differences.length} differences**` : 'agree')
      )
    }
    if (d.models) {
      out.push(
        `- \`${d.name}\`: migrations vs \`${rel(d.models.file)}\` — ` +
          (d.models.diff.length ? `**${d.models.diff.length} differences**` : 'agree')
      )
    }
  }
  out.push('')

  if (stale.length) {
    out.push('### Other diagrams that disagree with this schema')
    out.push('')
    out.push(
      'Hand-maintained ER diagrams found elsewhere in the tree that no longer match the ' +
        'migration sources. A stale diagram looks exactly like a fresh one, which is how ' +
        'gap **G14** went unnoticed — so they are checked on every run.'
    )
    out.push('')
    for (const f of stale) {
      out.push(`- \`${f.file}\``)
      for (const p of f.problems) out.push(`  - ${p}`)
    }
    out.push('')
  }

  if (notes.length) {
    out.push('> **Unresolved differences**')
    out.push('>')
    for (const n of notes) out.push(`> - ${n}`)
    out.push('')
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

/** Mermaid node ids must be identifier-safe. */
const ident = (s) => s.replace(/[^A-Za-z0-9_]/g, '_')

// ---------------------------------------------------------------- main

function main() {
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const stamp = args.includes('--stamp')

  const data = collect()

  // A source we could not fully parse means the document would be a guess.
  const unsupported = []
  for (const d of data.databases.values()) {
    for (const { source, parsed } of d.sources) {
      for (const u of parsed.unsupported ?? []) {
        unsupported.push(`${rel(source.dir)}: ${u.detail} (${u.file}${u.changeset ? ` changeset ${u.changeset}` : ''})`)
      }
    }
  }
  if (unsupported.length) {
    console.error('Cannot generate: the migration sources contain changes this script does not understand.\n')
    for (const u of unsupported) console.error(`  - ${u}`)
    console.error('\nTeach docs/db-schema/lib/ to read them rather than publishing an incomplete schema.')
    return 2
  }

  let body = render(data)
  if (stamp) {
    const sha = (() => {
      try {
        return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
          cwd: REPO,
          encoding: 'utf8'
        }).trim()
      } catch {
        return 'unknown'
      }
    })()
    body += `\n<!-- generated from ${sha} -->\n`
  }

  if (check) {
    if (!existsSync(OUTPUT)) {
      console.error(`${rel(OUTPUT)} does not exist. Run: node docs/db-schema/generate.js`)
      return 1
    }
    const current = readFileSync(OUTPUT, 'utf8')
    if (current !== body) {
      console.error(`${rel(OUTPUT)} is out of date with the migration sources.`)
      console.error('Run: node docs/db-schema/generate.js')
      return 1
    }
    console.log(`${rel(OUTPUT)} is up to date.`)
    return 0
  }

  mkdirSync(path.dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, body)

  const tables = [...data.databases.values()].reduce((n, d) => n + d.primary.parsed.tables.size, 0)
  console.log(
    `Wrote ${rel(OUTPUT)} — ${tables} tables across ${data.databases.size} databases, ` +
      `from ${data.sources.length} migration sources.`
  )
  for (const n of data.notes) console.log(`  ! ${n}`)
  if (data.unknown.length) {
    for (const u of data.unknown) console.log(`  ? unrecognised source: ${u.dir} (${u.tool})`)
  }
  for (const f of data.stale) {
    console.log(`  ! stale diagram: ${f.file} — ${f.problems.join('; ')}`)
  }
  return data.notes.length ? 1 : 0
}

process.exit(main())
