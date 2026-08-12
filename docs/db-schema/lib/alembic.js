/**
 * Replay an Alembic revision chain into the schema it produces.
 *
 * The Alembic equivalent of the Liquibase rollback trap is `downgrade()`: it
 * holds the inverse of every change, so reading it alongside `upgrade()` would
 * cancel the migration out. Only `upgrade()` is parsed.
 *
 * Revisions are applied in `down_revision` order, not filename order — the
 * later revision ids are content hashes and sort arbitrarily.
 *
 * Anything unrecognised lands in `unsupported` so the generator can refuse to
 * emit a document it cannot vouch for.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import {
  calls,
  functionBody,
  kwargs,
  moduleConstants,
  positional,
  pyString,
  resolve,
  splitArgs,
  unrollLoops
} from './python.js'
import { parseSql } from './sql.js'

/** Alembic operations with no effect on the tables or columns we document. */
const NO_SCHEMA_EFFECT = new Set([
  'create_index',
  'drop_index',
  'bulk_insert',
  'get_bind',
  'get_context',
  'inline_literal',
  'create_check_constraint',
  'drop_constraint',
  'create_unique_constraint',
  'create_foreign_key'
])

/** SQLAlchemy / GeoAlchemy2 type expression → the Postgres type it creates. */
export function pgType(expr, consts) {
  const src = expr.trim()

  const geo = /Geometry\s*\(([\s\S]*)\)/.exec(src)
  if (geo) {
    const kw = kwargs(geo[1])
    const kind = pyString(kw.get('geometry_type') ?? '', consts) ?? 'GEOMETRY'
    const srid = kw.get('srid') ?? '0'
    return `geometry(${kind},${srid})`
  }

  if (/\bJSONB\b/.test(src)) return 'jsonb'
  if (/\bJSON\b/.test(src)) return 'json'
  if (/\bARRAY\s*\(/.test(src)) return 'array'

  const m = /(?:^|\.)(\w+)\s*\(([\s\S]*)\)\s*$/.exec(src)
  const name = (m ? m[1] : src).toLowerCase()
  const inner = m ? m[2] : ''
  const args = splitArgs(inner).filter((a) => !/^\w+\s*=/.test(a))
  const kw = kwargs(inner)

  switch (name) {
    case 'uuid':
    case 'guid':
      return 'uuid'
    case 'string':
    case 'unicode':
    case 'varchar':
      return args[0] ? `varchar(${args[0]})` : 'varchar'
    case 'text':
    case 'unicodetext':
      return 'text'
    case 'integer':
    case 'int':
      return 'integer'
    case 'biginteger':
      return 'bigint'
    case 'smallinteger':
      return 'smallint'
    case 'float':
      return 'double precision'
    case 'numeric':
    case 'decimal':
      return args.length ? `numeric(${args.join(',')})` : 'numeric'
    case 'boolean':
      return 'boolean'
    case 'date':
      return 'date'
    case 'time':
      return 'time'
    case 'datetime':
    case 'timestamp':
      return /true/i.test(kw.get('timezone') ?? '') ? 'timestamptz' : 'timestamp'
    case 'largebinary':
      return 'bytea'
    case 'enum':
      return 'enum'
    default:
      return name
  }
}

function columnFromCall(args, consts) {
  const pos = positional(args)
  const kw = kwargs(args)
  const name = resolve(pos[0], consts)
  if (name === null) return null

  let dflt = null
  const sd = kw.get('server_default')
  if (sd !== undefined) {
    if (consts.has(sd)) dflt = consts.get(sd)
    else if (/^sa\.(false|true)\(\)$/.test(sd)) dflt = sd.includes('false') ? 'false' : 'true'
    else {
      const text = /^sa\.text\(([\s\S]*)\)$/.exec(sd)
      dflt = text ? pyString(text[1], consts) : (pyString(sd, consts) ?? sd)
    }
  }

  return {
    name,
    type: pos[1] ? pgType(pos[1], consts) : 'unknown',
    // SQLAlchemy defaults nullable to true when the argument is absent.
    notNull: /false/i.test(kw.get('nullable') ?? 'true'),
    primaryKey: /true/i.test(kw.get('primary_key') ?? ''),
    unique: /true/i.test(kw.get('unique') ?? ''),
    identity: false,
    generatedAs: null,
    default: dflt,
    // `default=uuid4` is applied by Python, not by Postgres. Recording the
    // difference matters: a raw INSERT that omits the column will fail.
    clientDefault: kw.has('default') ? kw.get('default') : null,
    remarks: pyString(kw.get('comment') ?? '', consts),
    references: null,
    onDeleteCascade: false,
    constraintName: null
  }
}

/** Order revision files by following `down_revision`, root first. */
export function revisionOrder(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.py') && f !== '__init__.py')
  const byRevision = new Map()

  for (const f of files) {
    const src = readFileSync(path.join(dir, f), 'utf8')
    const rev = /^revision(?::\s*str)?\s*=\s*["']([^"']+)["']/m.exec(src)?.[1]
    const down = /^down_revision(?::[^=]*)?\s*=\s*(?:["']([^"']+)["']|None)/m.exec(src)
    if (!rev) continue
    byRevision.set(rev, { file: f, src, revision: rev, down: down?.[1] ?? null })
  }

  const children = new Map()
  for (const r of byRevision.values()) {
    const key = r.down ?? '__root__'
    if (!children.has(key)) children.set(key, [])
    children.get(key).push(r)
  }

  const ordered = []
  const walk = (key) => {
    for (const r of (children.get(key) ?? []).sort((a, b) => a.file.localeCompare(b.file))) {
      ordered.push(r)
      walk(r.revision)
    }
  }
  walk('__root__')

  // Anything not reachable from the root (a broken chain) is still reported.
  const seen = new Set(ordered.map((r) => r.revision))
  for (const r of byRevision.values()) if (!seen.has(r.revision)) ordered.push({ ...r, orphan: true })

  return ordered
}

export function readAlembic(dir) {
  const S = {
    tables: new Map(),
    constraints: [],
    indexes: [],
    unsupported: [],
    revisions: 0,
    order: []
  }
  if (!existsSync(dir)) return S

  for (const rev of revisionOrder(dir)) {
    S.revisions++
    S.order.push(rev.revision)
    const ctx = { file: rev.file, revision: rev.revision }
    if (rev.orphan) {
      S.unsupported.push({ ...ctx, detail: 'revision not reachable from the root of the chain' })
    }

    const { consts, lists } = moduleConstants(rev.src)
    // Trap: downgrade() holds the inverse of every change.
    const body = functionBody(rev.src, 'upgrade')
    if (body === null) {
      S.unsupported.push({ ...ctx, detail: 'no upgrade() function found' })
      continue
    }

    for (const call of calls(unrollLoops(body, lists), 'op')) {
      const pos = positional(call.args)
      const kw = kwargs(call.args)

      switch (call.method) {
        case 'create_table': {
          const name = resolve(pos[0], consts)
          if (name === null) {
            S.unsupported.push({ ...ctx, detail: 'create_table with a non-literal name' })
            break
          }
          // A conditional re-create (repairing drifted databases) names a table
          // the chain already created; keep the original definition.
          if (S.tables.has(name)) break

          const columns = []
          for (const arg of splitArgs(call.args).slice(1)) {
            const col = /^sa\.Column\s*\(([\s\S]*)\)$/.exec(arg)
            if (col) {
              const parsed = columnFromCall(col[1], consts)
              if (parsed) columns.push(parsed)
              continue
            }
            const pk = /^sa\.PrimaryKeyConstraint\s*\(([\s\S]*)\)$/.exec(arg)
            if (pk) {
              for (const c of positional(pk[1])) {
                const n = pyString(c, consts)
                const target = columns.find((x) => x.name === n)
                if (target) {
                  target.primaryKey = true
                  target.notNull = true
                }
              }
              continue
            }
            const uq = /^sa\.UniqueConstraint\s*\(([\s\S]*)\)$/.exec(arg)
            if (uq) {
              const cols = positional(uq[1])
                .map((c) => pyString(c, consts))
                .filter(Boolean)
              S.constraints.push({
                table: name,
                name: pyString(kwargs(uq[1]).get('name') ?? '', consts),
                kind: 'UNIQUE',
                columns: cols
              })
              continue
            }
            const fk = /^sa\.ForeignKeyConstraint\s*\(([\s\S]*)\)$/.exec(arg)
            if (fk) {
              const fkPos = positional(fk[1])
              const local = splitArgs(fkPos[0]?.replace(/^\[|\]$/g, '') ?? '')
                .map((c) => pyString(c, consts))
                .filter(Boolean)
              const remote = splitArgs(fkPos[1]?.replace(/^\[|\]$/g, '') ?? '')
                .map((c) => pyString(c, consts))
                .filter(Boolean)
              local.forEach((lc, i) => {
                const target = columns.find((x) => x.name === lc)
                const [rt, rc] = (remote[i] ?? '').replace(/^public\./, '').split('.')
                if (target && rt) {
                  target.references = { table: rt, column: rc }
                  target.onDeleteCascade = /cascade/i.test(kwargs(fk[1]).get('ondelete') ?? '')
                }
              })
              continue
            }
          }
          S.tables.set(name, {
            name,
            columns,
            schema: pyString(kw.get('schema') ?? '', consts) ?? 'public',
            source: ctx
          })
          break
        }

        case 'add_column': {
          const table = resolve(pos[0], consts)
          const col = /sa\.Column\s*\(([\s\S]*)\)\s*$/.exec(pos[1] ?? '')
          const t = S.tables.get(table)
          const parsed = col ? columnFromCall(col[1], consts) : null
          if (t && parsed) t.columns.push(parsed)
          else S.unsupported.push({ ...ctx, detail: `add_column not applied on ${table}` })
          break
        }

        case 'drop_column': {
          const t = S.tables.get(resolve(pos[0], consts))
          const name = resolve(pos[1], consts)
          if (t) t.columns = t.columns.filter((c) => c.name !== name)
          break
        }

        case 'drop_table':
          S.tables.delete(resolve(pos[0], consts))
          break

        case 'rename_table': {
          const from = resolve(pos[0], consts)
          const to = resolve(pos[1], consts)
          const t = S.tables.get(from)
          if (t && to) {
            S.tables.delete(from)
            t.name = to
            S.tables.set(to, t)
          }
          break
        }

        case 'alter_column': {
          const t = S.tables.get(resolve(pos[0], consts))
          const col = t?.columns.find((c) => c.name === resolve(pos[1], consts))
          if (col) {
            if (kw.has('nullable')) col.notNull = /false/i.test(kw.get('nullable'))
            if (kw.has('type_')) col.type = pgType(kw.get('type_'), consts)
            if (kw.has('new_column_name')) {
              col.name = pyString(kw.get('new_column_name'), consts) ?? col.name
            }
          }
          break
        }

        case 'execute': {
          const raw = consts.has(pos[0]?.trim())
            ? consts.get(pos[0].trim())
            : pyString(/^sa\.text\(([\s\S]*)\)$/.exec(pos[0] ?? '')?.[1] ?? pos[0] ?? '', consts)
          if (raw === null) {
            S.unsupported.push({ ...ctx, detail: 'op.execute with an unreadable argument' })
            break
          }
          for (const st of parseSql(raw)) {
            if (st.op === 'dropTable') S.tables.delete(st.table)
            else if (st.op === 'createTable' && !S.tables.has(st.table)) {
              S.tables.set(st.table, { name: st.table, columns: st.columns, schema: 'public', source: ctx })
            } else if (st.op === 'addColumn') {
              S.tables.get(st.table)?.columns.push(st.column)
            } else if (st.op === 'dropColumn') {
              const t = S.tables.get(st.table)
              if (t) t.columns = t.columns.filter((c) => c.name !== st.column)
            } else if (st.op === 'alterColumn') {
              const col = S.tables.get(st.table)?.columns.find((c) => c.name === st.column)
              if (col) {
                if (st.type !== undefined) col.type = st.type
                if (st.notNull !== undefined) col.notNull = st.notNull
                if ('default' in st) col.default = st.default
              }
            } else if (st.op === 'unknown') {
              S.unsupported.push({ ...ctx, detail: `raw SQL: ${st.sql.slice(0, 120)}` })
            }
          }
          for (const m of raw.matchAll(
            /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+([\w.]+)\s*(?:USING\s+(\w+)\s*)?\(([^)]*)\)([^;]*)/gi
          )) {
            S.indexes.push({
              table: m[3].replace(/^public\./i, ''),
              name: m[2],
              unique: Boolean(m[1]),
              using: m[4] ?? null,
              columns: m[5].split(',').map((c) => c.trim()),
              where: /WHERE\s+(.+?)\s*$/i.exec(m[6]?.trim() ?? '')?.[1] ?? null,
              source: ctx
            })
          }
          break
        }

        case 'create_index':
          S.indexes.push({
            table: resolve(pos[1], consts),
            name: resolve(pos[0], consts),
            unique: /true/i.test(kw.get('unique') ?? ''),
            columns: splitArgs((pos[2] ?? '').replace(/^\[|\]$/g, ''))
              .map((c) => pyString(c, consts))
              .filter(Boolean),
            source: ctx
          })
          break

        case 'drop_index':
          S.indexes = S.indexes.filter((i) => i.name !== resolve(pos[0], consts))
          break

        default:
          if (!NO_SCHEMA_EFFECT.has(call.method)) {
            S.unsupported.push({ ...ctx, detail: `unhandled op.${call.method}()` })
          }
      }
    }
  }

  return S
}
