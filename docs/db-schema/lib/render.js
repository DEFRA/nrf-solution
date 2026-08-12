/**
 * Render a parsed schema as Markdown with Mermaid ER diagrams.
 *
 * Two constraints shape everything here:
 *
 * 1. **Mermaid type tokens cannot contain spaces, commas or parentheses.**
 *    `character varying(255)` and `geometry(MULTIPOLYGON,27700)` are legal
 *    Postgres and illegal Mermaid, so types are normalised to a single token
 *    and the real type is preserved in the column comment.
 *
 * 2. **The output is diffed in CI**, so it must be deterministic: stable
 *    ordering everywhere, and no timestamps or environment-derived values in
 *    the body. Anything that changes run-to-run would make every build fail.
 */

/**
 * Normalise a declared type to the form Postgres itself reports.
 *
 * The two tools declare the same types differently — Liquibase writes
 * `TIMESTAMP WITH TIME ZONE` and `INT`, SQLAlchemy yields `timestamptz` and
 * `integer` — so without this the two halves of one document disagree about
 * what the same type is called.
 */
export function canonicalType(type) {
  const raw = (type ?? 'unknown').trim()

  // geometry(MultiPolygon,27700): the geometry type name is meaningful, keep it.
  const geo = /^geometry\s*\(([^,)]*)(?:,\s*(\d+))?\)$/i.exec(raw)
  if (geo) return `geometry(${geo[1].trim()}${geo[2] ? `,${geo[2]}` : ''})`

  const t = raw.toLowerCase().replace(/\s*\(\s*/, '(').replace(/\s*\)\s*$/, ')').replace(/,\s*/g, ',')
  const [, base, args] = /^([^(]*)(\([^)]*\))?$/.exec(t) ?? [, t, '']
  const name = base.trim().replace(/\s+/g, ' ')

  const alias = {
    'timestamp with time zone': 'timestamptz',
    'timestamp without time zone': 'timestamp',
    'time with time zone': 'timetz',
    'time without time zone': 'time',
    'character varying': 'varchar',
    character: 'char',
    int: 'integer',
    int4: 'integer',
    int8: 'bigint',
    int2: 'smallint',
    serial: 'integer',
    bigserial: 'bigint',
    decimal: 'numeric',
    bool: 'boolean',
    float8: 'double precision',
    float4: 'real'
  }

  return (alias[name] ?? name) + (args ?? '')
}

/** Postgres type → a token Mermaid will accept. */
export function mermaidType(type) {
  const t = (type ?? 'unknown').toLowerCase().trim()
  if (/^character varying/.test(t) || /^varchar/.test(t)) return 'varchar'
  if (/^character/.test(t) || /^char/.test(t)) return 'char'
  if (/^timestamp with time zone/.test(t) || t === 'timestamptz') return 'timestamptz'
  if (/^timestamp/.test(t)) return 'timestamp'
  if (/^time with time zone/.test(t)) return 'timetz'
  if (/^double precision/.test(t)) return 'double'
  if (/^numeric|^decimal/.test(t)) return 'numeric'
  if (/^geometry/.test(t)) return 'geometry'
  if (/^geography/.test(t)) return 'geography'
  if (/\[\s*\]$/.test(t) || t === 'array') return `${t.replace(/\[\s*\]$/, '')}_array`.replace(/^array_array$/, 'array')
  if (/^int\b|^integer/.test(t)) return 'integer'
  if (/^bigint/.test(t)) return 'bigint'
  if (/^smallint/.test(t)) return 'smallint'
  if (/^bool/.test(t)) return 'boolean'
  return t.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, '_')
}

/** Mermaid comments are double-quoted; strip what would break the parser. */
const comment = (s) =>
  (s ?? '')
    .replace(/"/g, "'")
    .replace(/\|/g, '/')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 110)

/** A short description of a column, for the diagram's comment slot. */
function columnNote(col) {
  const bits = []
  const raw = canonicalType(col.type)
  // Surface the precise type when normalising for Mermaid loses information.
  if (raw !== mermaidType(raw) && /[(\[]/.test(raw)) bits.push(raw)
  if (col.generatedAs) bits.push('generated always, stored')
  else if (col.identity) bits.push('identity')
  const hasServerDefault = col.default !== null && col.default !== undefined
  if (hasServerDefault) bits.push(`default ${col.default}`)
  // An application-side default only matters when the database has none —
  // otherwise it is redundant detail about the ORM, not about the schema.
  else if (col.clientDefault) bits.push(`app default ${col.clientDefault}`)
  if (!col.notNull && !col.primaryKey) bits.push('nullable')
  if (col.onDeleteCascade) bits.push('ON DELETE CASCADE')
  if (col.remarks) bits.push(col.remarks)
  return comment(bits.join(', '))
}

/**
 * One `erDiagram` for the given tables.
 * `groupLabel` lets identical tables be drawn once (nine spatial layers share a
 * column set; drawing each would be nine identical blocks and less readable).
 */
export function erDiagram(tables, { uniqueColumns = new Map() } = {}) {
  const names = new Set(tables.map((t) => t.name))
  const lines = ['erDiagram']

  const rels = []
  for (const t of tables) {
    for (const c of t.columns) {
      if (c.references && names.has(c.references.table)) {
        rels.push(
          `    ${c.references.table} ||--o{ ${t.name} : "${comment(relationLabel(t.name, c))}"`
        )
      }
    }
  }
  // De-duplicate and order so the output is stable.
  for (const r of [...new Set(rels)].sort()) lines.push(r)
  if (rels.length) lines.push('')

  for (const t of tables) {
    lines.push(`    ${t.name} {`)
    for (const c of t.columns) {
      const keys = []
      if (c.primaryKey) keys.push('PK')
      if (c.references && !c.primaryKey) keys.push('FK')
      if (!c.primaryKey && !c.references && (c.unique || uniqueColumns.get(t.name)?.has(c.name))) {
        keys.push('UK')
      }
      const note = columnNote(c)
      lines.push(
        `        ${mermaidType(c.type)} ${c.name}${keys.length ? ' ' + keys.join(',') : ''}${
          note ? ` "${note}"` : ''
        }`
      )
    }
    lines.push('    }')
    lines.push('')
  }

  while (lines.at(-1) === '') lines.pop()
  return ['```mermaid', ...lines, '```'].join('\n')
}

function relationLabel(child, col) {
  if (col.onDeleteCascade) return 'has (cascade)'
  return col.notNull ? 'has' : 'has (optional)'
}

const yesNo = (b) => (b ? 'no' : 'yes') // "Null" column: notNull -> "no"

const escapeCell = (s) =>
  (s ?? '')
    .toString()
    .replace(/\|/g, '\\|')
    .replace(/\n+/g, ' ')
    .trim()

/** A Markdown dictionary table for one database table. */
export function columnTable(table, { constraints = [], indexes = [] } = {}) {
  const uniques = constraints.filter((c) => c.table === table.name && c.kind === 'UNIQUE')
  const isUnique = (name) => uniques.some((u) => u.columns?.length === 1 && u.columns[0] === name)

  const rows = table.columns.map((c) => {
    const notes = []
    if (c.primaryKey) notes.push('**PK**')
    if (isUnique(c.name)) notes.push('unique')
    if (c.references) {
      notes.push(
        `FK → \`${c.references.table}.${c.references.column}\`${
          c.onDeleteCascade ? ' `ON DELETE CASCADE`' : ''
        }`
      )
    }
    if (c.generatedAs) notes.push(`generated: \`${c.generatedAs}\``)
    if (c.identity) notes.push('identity')
    if (c.clientDefault && (c.default === null || c.default === undefined)) {
      notes.push(`application default \`${c.clientDefault}\` — applied in Python, **not** by the database`)
    }
    if (c.remarks) notes.push(c.remarks)
    if (indexes.some((i) => i.table === table.name && i.columns?.includes(c.name) && !i.where)) {
      notes.push('indexed')
    }
    return [
      `\`${c.name}\``,
      `\`${canonicalType(c.type)}\``,
      yesNo(c.notNull),
      c.default === null || c.default === undefined ? '—' : `\`${c.default}\``,
      notes.join('; ') || ''
    ].map(escapeCell)
  })

  return [
    '| Column | Type | Null | Default | Notes |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.join(' | ')} |`)
  ].join('\n')
}

/** A Markdown table of indexes and constraints for a whole database. */
export function indexTable(constraints, indexes) {
  const rows = []

  for (const c of [...constraints].sort(
    (a, b) => a.table.localeCompare(b.table) || (a.name ?? '').localeCompare(b.name ?? '')
  )) {
    rows.push([
      c.name ? `\`${c.name}\`` : '_(unnamed)_',
      `\`${c.table}\` (${(c.columns ?? []).map((x) => `\`${x}\``).join(', ')})`,
      c.kind === 'UNIQUE' ? 'UNIQUE constraint' : c.kind,
      ''
    ])
  }

  for (const i of [...indexes].sort(
    (a, b) => (a.table ?? '').localeCompare(b.table ?? '') || (a.name ?? '').localeCompare(b.name ?? '')
  )) {
    rows.push([
      i.name ? `\`${i.name}\`` : '_(unnamed)_',
      `\`${i.table}\` (${(i.columns ?? []).map((x) => `\`${x}\``).join(', ')})`,
      `${i.unique ? 'UNIQUE ' : ''}${i.using ? i.using.toUpperCase() : 'btree'} index${
        i.where ? ', partial' : ''
      }`,
      i.where ? `\`WHERE ${i.where}\`` : ''
    ])
  }

  if (!rows.length) return '_None._'

  return [
    '| Name | Table (columns) | Kind | Condition |',
    '| --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.map(escapeCell).join(' | ')} |`)
  ].join('\n')
}

/** Signature of a table's shape, for spotting tables that share a column set. */
export const shapeKey = (t) =>
  t.columns
    .map((c) => `${c.name}:${c.type}:${c.notNull ? 1 : 0}:${c.default ?? ''}`)
    .join('|')

/** Group tables by identical shape, preserving order of first appearance. */
export function groupByShape(tables) {
  const groups = new Map()
  for (const t of tables) {
    const k = shapeKey(t)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(t)
  }
  return [...groups.values()]
}
