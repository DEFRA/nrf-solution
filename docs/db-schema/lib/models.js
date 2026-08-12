/**
 * Read SQLAlchemy declarative models as an independent view of the schema.
 *
 * This is not a second source of truth — the migrations are what actually run.
 * It exists for two things the migrations cannot give:
 *
 *   - **Python-side defaults.** `default=uuid4` never reaches Postgres, so a
 *     migration-only reading would imply a server default that does not exist.
 *   - **A cross-check.** Models and migrations drifting apart is a real failure
 *     here, not a hypothetical: revision `c3d7e1f2a4b6` exists because databases
 *     were stamped onto a squashed baseline and permanently lost a table while
 *     `alembic current` reported success. Disagreement between the two is worth
 *     surfacing, so the generator compares them and reports what differs.
 *
 * Mixins are resolved: nine spatial layers declare no columns of their own and
 * inherit every one from `SpatialLayerMixin`.
 */

import { readFileSync, existsSync } from 'node:fs'
import { kwargs, positional, pyString, readValue, resolve, splitArgs } from './python.js'
import { pgType } from './alembic.js'

/** Split a Python module into top-level `class` blocks. */
function classes(src) {
  const out = []
  const re = /^class\s+(\w+)\s*(?:\(([^)]*)\))?\s*:/gm
  let m
  while ((m = re.exec(src))) {
    const start = m.index + m[0].length
    const rest = src.slice(start)
    const lines = rest.split('\n')
    const body = []
    for (const line of lines) {
      if (line.trim() === '') {
        body.push(line)
        continue
      }
      if (!/^[ \t]/.test(line)) break
      body.push(line)
    }
    out.push({
      name: m[1],
      bases: (m[2] ?? '')
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean),
      body: body.join('\n')
    })
  }
  return out
}

function columnsOf(body, consts) {
  const cols = []
  // `Mapped[...]` annotations nest — `Mapped[list[dict[str, Any]]]` — so the
  // closing bracket has to be found by counting, not by a character class.
  for (const m of body.matchAll(/^[ \t]*(\w+)\s*:\s*Mapped\[/gm)) {
    let i = m.index + m[0].length
    let depth = 1
    for (; i < body.length && depth > 0; i++) {
      if (body[i] === '[') depth++
      else if (body[i] === ']') depth--
    }
    const annotation = body.slice(m.index + m[0].length, i - 1)

    const assign = /^\s*=\s*/.exec(body.slice(i))
    if (!assign) continue

    const value = readValue(body, i + assign[0].length).trim()
    const call = /^mapped_column\s*\(([\s\S]*)\)$/.exec(value)
    if (!call) continue

    const args = call[1]
    const pos = positional(args)
    const kw = kwargs(args)

    // mapped_column("name", Type(), ...) or mapped_column(Type(), ...) where the
    // attribute name is the column name.
    const explicit = pos[0] ? pyString(pos[0], consts) : null
    const typeExpr = explicit !== null ? pos[1] : pos[0]

    let dflt = null
    const sd = kw.get('server_default')
    if (sd !== undefined) {
      if (consts.has(sd)) dflt = consts.get(sd)
      else if (/^func\.now\(\)$/.test(sd)) dflt = 'now()'
      else if (/^sa\.(false|true)\(\)$/.test(sd)) dflt = sd.includes('false') ? 'false' : 'true'
      else {
        const t = /^(?:sa\.)?text\(([\s\S]*)\)$/.exec(sd)
        dflt = t ? pyString(t[1], consts) : (pyString(sd, consts) ?? sd)
      }
    }

    cols.push({
      name: explicit ?? m[1],
      // The annotation carries nullability when the kwarg is absent.
      type: typeExpr ? pgType(typeExpr, consts) : annotationType(annotation),
      notNull: kw.has('nullable')
        ? /false/i.test(kw.get('nullable'))
        : /true/i.test(kw.get('primary_key') ?? '') || !/\|\s*None|Optional\[/.test(annotation),
      primaryKey: /true/i.test(kw.get('primary_key') ?? ''),
      unique: /true/i.test(kw.get('unique') ?? ''),
      indexed: /true/i.test(kw.get('index') ?? ''),
      identity: false,
      generatedAs: null,
      default: dflt,
      clientDefault: kw.get('default') ?? null,
      references: foreignKey(args, consts),
      onDeleteCascade: false,
      remarks: pyString(kw.get('comment') ?? '', consts),
      constraintName: null
    })
  }
  return cols
}

function foreignKey(args, consts) {
  const fk = /ForeignKey\s*\(([\s\S]*?)\)/.exec(args)
  if (!fk) return null
  const target = pyString(positional(fk[1])[0] ?? '', consts)
  if (!target) return null
  const parts = target.replace(/^public\./, '').split('.')
  return parts.length === 2 ? { table: parts[0], column: parts[1] } : null
}

/** Fall back to the type annotation when no explicit column type is given. */
function annotationType(ann) {
  const base = ann.replace(/\s*\|\s*None/, '').trim()
  if (/^str$/.test(base)) return 'varchar'
  if (/^int$/.test(base)) return 'integer'
  if (/^float$/.test(base)) return 'double precision'
  if (/^bool$/.test(base)) return 'boolean'
  if (/^datetime$/.test(base)) return 'timestamptz'
  if (/^UUID$/i.test(base)) return 'uuid'
  if (/dict|list/.test(base)) return 'jsonb'
  return 'unknown'
}

/** Read `__table_args__` for UniqueConstraint / Index / schema. */
function tableArgs(body, table, consts) {
  const m = /^\s*__table_args__\s*=\s*/m.exec(body)
  if (!m) return { schema: null, constraints: [], indexes: [] }
  const value = readValue(body, m.index + m[0].length).trim()

  const constraints = []
  const indexes = []
  let schema = null

  for (const dict of value.matchAll(/\{\s*["']schema["']\s*:\s*["'](\w+)["']\s*\}/g)) schema = dict[1]

  for (const uq of value.matchAll(/UniqueConstraint\s*\(([\s\S]*?)\)(?=\s*[,)])/g)) {
    const cols = positional(uq[1])
      .map((c) => pyString(c, consts))
      .filter(Boolean)
    constraints.push({
      table,
      kind: 'UNIQUE',
      name: pyString(kwargs(uq[1]).get('name') ?? '', consts),
      columns: cols
    })
  }

  for (const ix of value.matchAll(/\bIndex\s*\(([\s\S]*?)\)(?=\s*,\s*\n|\s*\)\s*,?\s*$)/g)) {
    const args = splitArgs(ix[1])
    const name = pyString(args[0] ?? '', consts)
    const cols = args
      .slice(1)
      .filter((a) => !/^\w+\s*=/.test(a))
      .map((c) => pyString(c, consts))
      .filter(Boolean)
    const kw = kwargs(ix[1])
    const where = kw.get('postgresql_where')
    indexes.push({
      table,
      name,
      columns: cols,
      unique: /true/i.test(kw.get('unique') ?? ''),
      where: where ? (pyString(/text\(([\s\S]*)\)/.exec(where)?.[1] ?? where, consts) ?? null) : null
    })
  }

  return { schema, constraints, indexes }
}

/**
 * @returns {{tables: Map, constraints: Array, indexes: Array}}
 */
export function readModels(file) {
  const empty = { tables: new Map(), constraints: [], indexes: [] }
  if (!existsSync(file)) return empty

  const src = readFileSync(file, 'utf8')
  const consts = new Map()
  const all = classes(src)

  // Mixins declare columns but no __tablename__; subclasses inherit them.
  const mixins = new Map()
  for (const c of all) {
    if (!/__tablename__/.test(c.body)) mixins.set(c.name, columnsOf(c.body, consts))
  }

  const S = { tables: new Map(), constraints: [], indexes: [] }

  for (const c of all) {
    const tableName = /__tablename__\s*=\s*["'](\w+)["']/.exec(c.body)?.[1]
    if (!tableName) continue

    const inherited = c.bases.flatMap((b) => mixins.get(b) ?? [])
    const own = columnsOf(c.body, consts)
    const seen = new Set(own.map((x) => x.name))
    const columns = [...inherited.filter((x) => !seen.has(x.name)), ...own]

    const args = tableArgs(c.body, tableName, consts)
    S.constraints.push(...args.constraints)
    S.indexes.push(...args.indexes)
    for (const col of columns) {
      if (col.indexed) {
        S.indexes.push({ table: tableName, name: null, columns: [col.name], unique: false })
      }
    }

    S.tables.set(tableName, {
      name: tableName,
      className: c.name,
      schema: args.schema ?? 'public',
      docstring: /^\s*"""([\s\S]*?)"""/.exec(c.body)?.[1]?.trim() ?? null,
      columns
    })
  }

  return S
}

/** Differences between a migration-derived schema and a model-derived one. */
export function compare(migrated, modelled) {
  const problems = []
  const mt = new Set(migrated.tables.keys())
  const dt = new Set(modelled.tables.keys())

  for (const t of [...mt].filter((x) => !dt.has(x)).sort()) {
    problems.push(`table \`${t}\` is created by a migration but has no model`)
  }
  for (const t of [...dt].filter((x) => !mt.has(x)).sort()) {
    problems.push(`table \`${t}\` has a model but is not created by any migration`)
  }
  for (const t of [...mt].filter((x) => dt.has(x)).sort()) {
    const a = new Set(migrated.tables.get(t).columns.map((c) => c.name))
    const b = new Set(modelled.tables.get(t).columns.map((c) => c.name))
    const onlyMigration = [...a].filter((c) => !b.has(c)).sort()
    const onlyModel = [...b].filter((c) => !a.has(c)).sort()
    if (onlyMigration.length) {
      problems.push(`\`${t}\`: in the migrations but not the model: ${onlyMigration.join(', ')}`)
    }
    if (onlyModel.length) {
      problems.push(`\`${t}\`: in the model but not the migrations: ${onlyModel.join(', ')}`)
    }
  }
  return problems
}
