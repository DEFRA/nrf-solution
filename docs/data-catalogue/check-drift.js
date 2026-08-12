#!/usr/bin/env node
/**
 * Check the NRF data catalogue against the codebase it describes.
 *
 * The catalogue lives in SharePoint, not in this repository, so nothing stops it
 * drifting as the schema changes. That already happened to
 * backend/docs/quote-database-diagram.md, which listed four dropped columns and
 * omitted two added ones, and became the source of a wrong data dictionary
 * (gap G14 in the catalogue).
 *
 * Usage:
 *   node docs/data-catalogue/check-drift.js ~/Downloads/"NRF Data Catalogue_V0.1.xlsx"
 *
 * Exit 0 = no drift, 1 = drift found. No dependencies — safe to run in CI.
 */

import { inflateRawSync } from 'node:zlib'
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

// Liquibase bookkeeping, PostGIS internals and Alembic state carry no governance
// decision and are deliberately out of scope for the catalogue.
const SYSTEM_TABLES = new Set([
  'databasechangelog',
  'databasechangeloglock',
  'spatial_ref_sys',
  'alembic_version'
])

// ---------------------------------------------------------------- xlsx reader
// An .xlsx is a ZIP of XML parts. Rather than take a dependency, we walk the ZIP
// central directory and inflate the parts we need.

function unzip(buf) {
  // End of Central Directory: scan back from the tail for signature 0x06054b50
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('not a zip file (no end-of-central-directory record)')

  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const files = new Map()

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break
    const method = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOff = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)

    // the local header repeats name/extra with its own lengths
    const lNameLen = buf.readUInt16LE(localOff + 26)
    const lExtraLen = buf.readUInt16LE(localOff + 28)
    const dataStart = localOff + 30 + lNameLen + lExtraLen
    const raw = buf.subarray(dataStart, dataStart + compSize)

    files.set(name, method === 0 ? raw : inflateRawSync(raw))
    p += 46 + nameLen + extraLen + commentLen
  }
  return files
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENTITIES[e])

function sharedStrings(files) {
  const part = files.get('xl/sharedStrings.xml')
  if (!part) return []
  const xml = part.toString('utf8')
  // one <si> per string; it may hold several <r><t> runs that concatenate
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(([, si]) =>
    [...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join('')
  )
}

/** Read a workbook into { sheetName: string[][] }. */
function readWorkbook(file) {
  const files = unzip(readFileSync(file))
  const strings = sharedStrings(files)

  // Attribute order varies by writer (openpyxl emits Type, Target, Id), so pull
  // each attribute out of the element independently rather than in sequence.
  const rels = new Map()
  const relsXml = files.get('xl/_rels/workbook.xml.rels')?.toString('utf8') ?? ''
  for (const [, el] of relsXml.matchAll(/(<Relationship\b[^>]*>)/g)) {
    const id = /\bId="([^"]+)"/.exec(el)?.[1]
    const target = /\bTarget="([^"]+)"/.exec(el)?.[1]
    if (id && target) rels.set(id, target.replace(/^\/?(xl\/)?/, ''))
  }

  const wbXml = files.get('xl/workbook.xml').toString('utf8')
  const out = {}

  for (const [, name, rid] of wbXml.matchAll(
    /<sheet[^>]*name="([^"]*)"[^>]*r:id="([^"]+)"/g
  )) {
    const part = files.get(`xl/${rels.get(rid)}`)
    if (!part) continue
    const rows = []
    for (const [, rowXml] of part.toString('utf8').matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = []
      for (const m of rowXml.matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = m[1]
        const body = m[2] ?? ''
        const col = /r="([A-Z]+)/.exec(attrs)?.[1] ?? ''
        let idx = 0
        for (const ch of col) idx = idx * 26 + (ch.charCodeAt(0) - 64)
        const type = /t="([^"]+)"/.exec(attrs)?.[1]
        let value = ''
        if (type === 's') {
          const i = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
          value = i !== undefined ? (strings[+i] ?? '') : ''
        } else if (type === 'inlineStr') {
          value = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
            .map((x) => decode(x[1]))
            .join('')
        } else {
          const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
          value = v === undefined ? '' : decode(v)
        }
        cells[idx - 1] = value
      }
      rows.push(cells)
    }
    out[decode(name)] = rows
  }
  return out
}

// ---------------------------------------------------------------- schema
// Reading the schema lives in docs/db-schema/lib/, shared with the generator
// that writes docs/database-schema.md. Two readers would drift apart, and the
// subtleties are exactly where drift hides: Liquibase `<rollback>` blocks hold
// the inverse operation, Alembic's `downgrade()` does the same, and schema
// changes also arrive as raw SQL. See those modules for the detail.
import { readLiquibase } from '../db-schema/lib/liquibase.js'
import { readAlembic } from '../db-schema/lib/alembic.js'

const backendSchema = () => {
  const dir = path.join(REPO, 'backend', 'changelog')
  return existsSync(dir) ? readLiquibase(dir) : null
}

const impactSchema = () => {
  const dir = path.join(REPO, 'impact-assessor', 'alembic', 'versions')
  return existsSync(dir) ? readAlembic(dir) : null
}

const domainTables = (schema) =>
  schema ? new Set([...schema.tables.keys()].filter((t) => !SYSTEM_TABLES.has(t))) : null

/**
 * Columns on `quotes` after every add and drop, in changeset order.
 *
 * The raw `<sql>` that creates `quotes.reference` is now parsed rather than
 * skipped, so — unlike the earlier hand-rolled version — there is no class of
 * column this cannot see, and no "verify by hand" caveat to report.
 */
function quotesColumns() {
  const schema = backendSchema()
  const table = schema?.tables.get('quotes')
  return table ? new Set(table.columns.map((c) => c.name)) : null
}

function submoduleShas() {
  try {
    const out = execFileSync('git', ['submodule', 'status'], {
      cwd: REPO,
      encoding: 'utf8'
    })
    const map = new Map()
    for (const line of out.split('\n')) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 2) map.set(parts[1], parts[0].replace(/^[+\-U]/, '').slice(0, 12))
    }
    return map
  } catch {
    return new Map()
  }
}

// ---------------------------------------------------------------- checks
function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('usage: node docs/data-catalogue/check-drift.js <catalogue.xlsx>')
    return 2
  }
  if (!existsSync(file)) {
    console.error(`not found: ${file}`)
    return 2
  }

  const wb = readWorkbook(file)
  const problems = []
  let checks = 0

  const dd = wb['Data Dictionary']
  const documented = new Set()
  let ti = 3
  let ci = 4
  if (dd) {
    const head = dd[0] ?? []
    if (head.includes('Table')) ti = head.indexOf('Table')
    if (head.includes('Column')) ci = head.indexOf('Column')
    for (const r of dd.slice(1)) if (r[ti]) documented.add(r[ti])
  } else {
    problems.push("no 'Data Dictionary' sheet")
  }

  // 1. every table in the code is catalogued
  for (const [label, actual] of [
    ['nrf_backend', domainTables(backendSchema())],
    ['nrf_impact', domainTables(impactSchema())]
  ]) {
    if (!actual) {
      console.log(`  ? ${label}: source not found (submodule not checked out?)`)
      continue
    }
    checks++
    const missing = [...actual].filter((t) => !documented.has(t)).sort()
    if (missing.length) {
      problems.push(`${label}: in the code but NOT in the catalogue: [${missing}]`)
    }
  }

  // 2. quotes columns match, replaying adds and drops in order
  const cols = quotesColumns()
  if (cols && dd) {
    checks++
    const docCols = new Set(
      dd.slice(1).filter((r) => r[ti] === 'quotes' && r[ci]).map((r) => r[ci])
    )
    const missing = [...cols].filter((c) => !docCols.has(c)).sort()
    const extra = [...docCols].filter((c) => !cols.has(c)).sort()
    if (missing.length) {
      problems.push(`quotes: in the changelog but NOT in the catalogue: [${missing}]`)
    }
    if (extra.length) {
      problems.push(`quotes: in the catalogue but DROPPED from the schema: [${extra}]`)
    }
  }

  // 3. pinned commits still current
  const sc = wb['Source Commits']
  if (sc) {
    checks++
    const current = submoduleShas()
    for (const row of sc) {
      for (let i = 0; i < row.length; i++) {
        const v = row[i] ?? ''
        if (v.startsWith('DEFRA/nrf-') && row[i + 1]) {
          const repo = v.split('/')[1]
          const name = repo.replace('nrf-', '')
          const pinned = String(row[i + 1]).trim()
          if (current.has(name) && current.get(name) !== pinned) {
            problems.push(
              `${repo}: catalogue pinned at ${pinned}, submodule now at ` +
                `${current.get(name)} — file:line references may have moved`
            )
          }
        }
      }
    }
  } else {
    problems.push("no 'Source Commits' sheet — file references are unresolvable")
  }

  console.log(`\n${checks} checks run against ${path.basename(file)}\n`)
  if (problems.length) {
    console.log('DRIFT FOUND:')
    for (const p of problems) console.log(`  - ${p}`)
    console.log(
      '\nRegenerate the catalogue rather than hand-patching it ' +
        '(see docs/data-catalogue/README.md).'
    )
    return 1
  }
  console.log('No drift: catalogue matches the current schema and pinned commits.')
  return 0
}

process.exit(main())
